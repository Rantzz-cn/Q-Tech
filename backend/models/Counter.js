const { query } = require('../config/database');

/**
 * Counter Model
 * Handles all database operations for counters
 */
class Counter {
  /**
   * Find counter by ID
   */
  static async findById(id) {
    const sql = `
      SELECT c.*, s.name as service_name, s.location as service_location
      FROM counters c
      JOIN services s ON c.service_id = s.id
      WHERE c.id = $1;
    `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find counters by service ID
   */
  static async findByServiceId(serviceId) {
    const sql = `
      SELECT c.*, s.name as service_name
      FROM counters c
      JOIN services s ON c.service_id = s.id
      WHERE c.service_id = $1 
        AND c.is_active = true 
        AND s.is_active = true
      ORDER BY c.counter_number;
    `;

    const result = await query(sql, [serviceId]);
    return result.rows;
  }

  /**
   * Find all counters
   */
  static async findAll(includeInactive = false) {
    const whereClause = includeInactive 
      ? '' 
      : 'WHERE c.is_active = true AND s.is_active = true';
    const sql = `
      SELECT c.*, s.name as service_name, s.location as service_location
      FROM counters c
      JOIN services s ON c.service_id = s.id
      ${whereClause}
      ORDER BY s.name, c.counter_number;
    `;

    const result = await query(sql);
    return result.rows;
  }

  /**
   * Create a new counter
   */
  static async create(counterData) {
    const {
      service_id,
      counter_number,
      name = null,
      status = 'closed',
      is_active = true,
    } = counterData;

    const sql = `
      INSERT INTO counters (
        service_id, counter_number, name, status, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await query(sql, [
      service_id,
      counter_number,
      name,
      status,
      is_active,
    ]);

    // Get counter with service info
    const counter = await Counter.findById(result.rows[0].id);
    return counter;
  }

  /**
   * Update a counter
   */
  static async update(id, counterData) {
    const {
      service_id,
      counter_number,
      name,
      status,
      is_active,
    } = counterData;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (service_id !== undefined) {
      updates.push(`service_id = $${paramCount++}`);
      values.push(service_id);
    }
    if (counter_number !== undefined) {
      updates.push(`counter_number = $${paramCount++}`);
      values.push(counter_number);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `
      UPDATE counters
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    const result = await query(sql, values);
    
    // Get counter with service info
    const counter = await Counter.findById(result.rows[0].id);
    return counter;
  }

  /**
   * Delete (deactivate) a counter
   */
  static async delete(id) {
    // Soft delete - set is_active to false
    const sql = `
      UPDATE counters
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Get counters assigned to a staff member
   */
  static async findByStaffId(userId) {
    const sql = `
      SELECT c.*, s.name as service_name, s.location as service_location,
             cs.is_primary
      FROM counters c
      JOIN counter_staff cs ON c.id = cs.counter_id
      JOIN services s ON c.service_id = s.id
      WHERE cs.user_id = $1 
        AND c.is_active = true 
        AND s.is_active = true
      ORDER BY cs.is_primary DESC, s.name, c.counter_number;
    `;

    const result = await query(sql, [userId]);
    return result.rows;
  }

  /**
   * Update counter status
   */
  static async updateStatus(counterId, status) {
    const allowedStatuses = ['open', 'busy', 'closed', 'break'];
    if (!allowedStatuses.includes(status)) {
      throw new Error('Invalid counter status');
    }

    const sql = `
      UPDATE counters
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;

    const result = await query(sql, [status, counterId]);
    return result.rows[0];
  }

  /**
   * Set current serving queue
   */
  static async setCurrentServing(counterId, queueEntryId) {
    const sql = `
      UPDATE counters
      SET current_serving_queue_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;

    const result = await query(sql, [queueEntryId, counterId]);
    return result.rows[0];
  }

  /**
   * Get next waiting queue for a counter's service
   */
  static async getNextWaitingQueue(serviceId) {
    const sql = `
      SELECT *
      FROM queue_entries
      WHERE service_id = $1
        AND status = 'waiting'
      ORDER BY queue_position ASC, requested_at ASC
      LIMIT 1;
    `;

    const result = await query(sql, [serviceId]);
    return result.rows[0] || null;
  }

  /**
   * Get counter statistics
   */
  static async getCounterStats(counterId, date = null) {
    const dateFilter = date 
      ? `AND DATE(qe.requested_at) = $2`
      : `AND DATE(qe.requested_at) = CURRENT_DATE`;
    
    const params = date ? [counterId, date] : [counterId];

    const sql = `
      SELECT 
        COUNT(*) FILTER (WHERE qe.status = 'completed') as completed_today,
        COUNT(*) FILTER (WHERE qe.status = 'cancelled') as cancelled_today,
        AVG(EXTRACT(EPOCH FROM (qe.completed_at - qe.started_serving_at))/60) 
          FILTER (WHERE qe.status = 'completed') as avg_service_time,
        MIN(EXTRACT(EPOCH FROM (qe.completed_at - qe.started_serving_at))/60) 
          FILTER (WHERE qe.status = 'completed') as min_service_time,
        MAX(EXTRACT(EPOCH FROM (qe.completed_at - qe.started_serving_at))/60) 
          FILTER (WHERE qe.status = 'completed') as max_service_time
      FROM queue_entries qe
      WHERE qe.counter_id = $1 ${dateFilter};
    `;

    const result = await query(sql, params);
    return result.rows[0] || {
      completed_today: 0,
      cancelled_today: 0,
      avg_service_time: null,
      min_service_time: null,
      max_service_time: null,
    };
  }
}

module.exports = Counter;

