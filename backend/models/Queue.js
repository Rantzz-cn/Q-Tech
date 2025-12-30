const { query } = require('../config/database');

/**
 * Queue Model
 * Handles all database operations for queue entries
 */
class Queue {
  /**
   * Generate queue number for a service
   */
  static async generateQueueNumber(serviceId) {
    // Get service name and queue prefix
    const serviceSql = `SELECT name, COALESCE(queue_prefix, '') as queue_prefix FROM services WHERE id = $1;`;
    const serviceResult = await query(serviceSql, [serviceId]);
    
    if (!serviceResult.rows[0]) {
      throw new Error('Service not found');
    }

    const serviceName = serviceResult.rows[0].name;
    // Use custom queue_prefix if set, otherwise use first 3 letters of service name
    const prefix = (serviceResult.rows[0].queue_prefix && serviceResult.rows[0].queue_prefix.trim()) 
      ? serviceResult.rows[0].queue_prefix.trim().toUpperCase()
      : serviceName.substring(0, 3).toUpperCase();

    // Get last queue number for today
    const today = new Date().toISOString().split('T')[0];
    const lastNumberSql = `
      SELECT queue_number
      FROM queue_entries
      WHERE service_id = $1
        AND DATE(requested_at) = $2
        AND queue_number LIKE $3
      ORDER BY id DESC
      LIMIT 1;
    `;

    const lastResult = await query(lastNumberSql, [
      serviceId,
      today,
      `${prefix}-%`,
    ]);

    let nextNumber = 1;
    if (lastResult.rows[0]) {
      const lastNumber = lastResult.rows[0].queue_number;
      const numberPart = parseInt(lastNumber.split('-')[1]);
      nextNumber = numberPart + 1;
    }

    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Calculate queue position
   */
  static async calculateQueuePosition(serviceId) {
    const sql = `
      SELECT COUNT(*) as position
      FROM queue_entries
      WHERE service_id = $1
        AND status = 'waiting'
        AND requested_at < NOW();
    `;

    const result = await query(sql, [serviceId]);
    return parseInt(result.rows[0].position) + 1;
  }

  /**
   * Create a new queue entry
   */
  static async create(queueData) {
    const { userId, serviceId } = queueData;

    // Generate queue number
    const queueNumber = await this.generateQueueNumber(serviceId);
    
    // Calculate position
    const queuePosition = await this.calculateQueuePosition(serviceId);

    // Get estimated wait time from service
    const serviceSql = `SELECT estimated_service_time FROM services WHERE id = $1;`;
    const serviceResult = await query(serviceSql, [serviceId]);
    const estimatedWaitTime = serviceResult.rows[0]?.estimated_service_time || 5;

    const sql = `
      INSERT INTO queue_entries (
        user_id, service_id, queue_number, queue_position,
        status, estimated_wait_time
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, service_id, queue_number, queue_position,
                status, estimated_wait_time, requested_at;
    `;

    const values = [
      userId,
      serviceId,
      queueNumber,
      queuePosition,
      'waiting',
      estimatedWaitTime * queuePosition, // Multiply by position for estimate
    ];

    const result = await query(sql, values);
    
    // Log the queue creation
    await this.logQueueAction(result.rows[0].id, serviceId, null, 'created');

    return result.rows[0];
  }

  /**
   * Find queue entry by ID
   */
  static async findById(id) {
    const sql = `
      SELECT qe.*, s.name as service_name, s.location as service_location,
             u.first_name, u.last_name, u.email
      FROM queue_entries qe
      JOIN services s ON qe.service_id = s.id
      JOIN users u ON qe.user_id = u.id
      WHERE qe.id = $1;
    `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find queue entry by user ID and service ID (check if user already in queue)
   */
  static async findByUserAndService(userId, serviceId) {
    const sql = `
      SELECT *
      FROM queue_entries
      WHERE user_id = $1
        AND service_id = $2
        AND status IN ('waiting', 'called', 'serving');
    `;

    const result = await query(sql, [userId, serviceId]);
    return result.rows[0] || null;
  }

  /**
   * Get user's queue history
   */
  static async getUserHistory(userId, limit = 20, offset = 0) {
    const sql = `
      SELECT qe.*, s.name as service_name
      FROM queue_entries qe
      JOIN services s ON qe.service_id = s.id
      WHERE qe.user_id = $1
      ORDER BY qe.requested_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM queue_entries
      WHERE user_id = $1;
    `;

    const [result, countResult] = await Promise.all([
      query(sql, [userId, limit, offset]),
      query(countSql, [userId]),
    ]);

    return {
      queues: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    };
  }

  /**
   * Get queue status for a service
   */
  static async getServiceQueueStatus(serviceId) {
    const sql = `
      SELECT 
        qe.id, qe.queue_number, qe.queue_position, qe.status,
        qe.requested_at, qe.estimated_wait_time,
        c.counter_number, c.name as counter_name
      FROM queue_entries qe
      LEFT JOIN counters c ON qe.counter_id = c.id
      WHERE qe.service_id = $1
        AND qe.status IN ('waiting', 'called', 'serving')
      ORDER BY 
        CASE qe.status
          WHEN 'serving' THEN 1
          WHEN 'called' THEN 2
          WHEN 'waiting' THEN 3
        END,
        qe.queue_position;
    `;

    const result = await query(sql, [serviceId]);
    return result.rows;
  }

  /**
   * Cancel a queue entry
   */
  static async cancel(queueId, userId) {
    // Verify ownership
    const queueSql = `SELECT * FROM queue_entries WHERE id = $1 AND user_id = $2;`;
    const queueResult = await query(queueSql, [queueId, userId]);
    
    if (!queueResult.rows[0]) {
      throw new Error('Queue entry not found or access denied');
    }

    const queue = queueResult.rows[0];
    if (queue.status === 'completed' || queue.status === 'cancelled') {
      throw new Error('Queue entry cannot be cancelled');
    }

    const sql = `
      UPDATE queue_entries
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(sql, [queueId]);
    
    // Log the cancellation
    await this.logQueueAction(queueId, queue.service_id, queue.counter_id, 'cancelled');

    return result.rows[0];
  }

  /**
   * Get all queues with filters (for admin)
   */
  static async findAll(filters = {}) {
    const {
      status,
      serviceId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = filters;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (status) {
      whereConditions.push(`qe.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (serviceId) {
      whereConditions.push(`qe.service_id = $${paramIndex}`);
      queryParams.push(serviceId);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`DATE(qe.requested_at) >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`DATE(qe.requested_at) <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        qe.queue_number ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR
        u.last_name ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        s.name ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const offset = (page - 1) * limit;
    queryParams.push(limit, offset);

    const sql = `
      SELECT 
        qe.id, qe.queue_number, qe.queue_position, qe.status,
        qe.requested_at, qe.called_at, qe.started_serving_at, qe.completed_at,
        qe.estimated_wait_time,
        s.id as service_id, s.name as service_name, s.location as service_location,
        c.id as counter_id, c.counter_number, c.name as counter_name,
        u.id as user_id, u.first_name, u.last_name, u.email, u.student_id
      FROM queue_entries qe
      JOIN services s ON qe.service_id = s.id
      JOIN users u ON qe.user_id = u.id
      LEFT JOIN counters c ON qe.counter_id = c.id
      ${whereClause}
      ORDER BY qe.requested_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM queue_entries qe
      JOIN services s ON qe.service_id = s.id
      JOIN users u ON qe.user_id = u.id
      LEFT JOIN counters c ON qe.counter_id = c.id
      ${whereClause};
    `;

    const [result, countResult] = await Promise.all([
      query(sql, queryParams),
      query(countSql, queryParams.slice(0, -2)), // Remove limit and offset for count
    ]);

    return {
      queues: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
    };
  }

  /**
   * Log queue action
   */
  static async logQueueAction(queueEntryId, serviceId, counterId, action, metadata = null) {
    const sql = `
      INSERT INTO queue_logs (
        queue_entry_id, service_id, counter_id, action, metadata
      )
      VALUES ($1, $2, $3, $4, $5);
    `;

    await query(sql, [queueEntryId, serviceId, counterId, action, metadata ? JSON.stringify(metadata) : null]);
  }
}

module.exports = Queue;

