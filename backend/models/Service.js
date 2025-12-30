const { query } = require('../config/database');

/**
 * Service Model
 * Handles all database operations for services
 */
class Service {
  /**
   * Get all active services
   */
  static async findAll(includeInactive = false) {
    try {
      const whereClause = includeInactive ? '' : 'WHERE is_active = true';
      const sql = `
        SELECT id, name, description, location, is_active, 
               estimated_service_time, max_queue_size,
               operating_hours_start, operating_hours_end,
               COALESCE(queue_prefix, '') as queue_prefix,
               created_at, updated_at
        FROM services
        ${whereClause}
        ORDER BY name;
      `;

      const result = await query(sql);
      return result.rows;
    } catch (error) {
      // If queue_prefix column doesn't exist, try without it
      if (error.message && error.message.includes('queue_prefix')) {
        const whereClause = includeInactive ? '' : 'WHERE is_active = true';
        const sql = `
          SELECT id, name, description, location, is_active, 
                 estimated_service_time, max_queue_size,
                 operating_hours_start, operating_hours_end,
                 '' as queue_prefix,
                 created_at, updated_at
          FROM services
          ${whereClause}
          ORDER BY name;
        `;
        const result = await query(sql);
        return result.rows;
      }
      throw error;
    }
  }

  /**
   * Create a new service
   */
  static async create(serviceData) {
    const {
      name,
      description,
      location,
      estimated_service_time = 5,
      max_queue_size = 100,
      operating_hours_start = null,
      operating_hours_end = null,
      is_active = true,
      queue_prefix = null,
    } = serviceData;

    const sql = `
      INSERT INTO services (
        name, description, location, estimated_service_time,
        max_queue_size, operating_hours_start, operating_hours_end, is_active, queue_prefix
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const result = await query(sql, [
      name,
      description,
      location,
      estimated_service_time,
      max_queue_size,
      operating_hours_start,
      operating_hours_end,
      is_active,
      queue_prefix || null,
    ]);

    return result.rows[0];
  }

  /**
   * Update a service
   */
  static async update(id, serviceData) {
    const {
      name,
      description,
      location,
      estimated_service_time,
      max_queue_size,
      operating_hours_start,
      operating_hours_end,
      is_active,
      queue_prefix,
    } = serviceData;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (estimated_service_time !== undefined) {
      updates.push(`estimated_service_time = $${paramCount++}`);
      values.push(estimated_service_time);
    }
    if (max_queue_size !== undefined) {
      updates.push(`max_queue_size = $${paramCount++}`);
      values.push(max_queue_size);
    }
    if (operating_hours_start !== undefined) {
      updates.push(`operating_hours_start = $${paramCount++}`);
      values.push(operating_hours_start);
    }
    if (operating_hours_end !== undefined) {
      updates.push(`operating_hours_end = $${paramCount++}`);
      values.push(operating_hours_end);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (queue_prefix !== undefined) {
      updates.push(`queue_prefix = $${paramCount++}`);
      values.push(queue_prefix || null);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `
      UPDATE services
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Delete (deactivate) a service
   */
  static async delete(id) {
    // Soft delete - set is_active to false
    const sql = `
      UPDATE services
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Find service by ID
   */
  static async findById(id) {
    const sql = `
      SELECT id, name, description, location, is_active,
             estimated_service_time, max_queue_size,
             operating_hours_start, operating_hours_end,
             COALESCE(queue_prefix, '') as queue_prefix,
             created_at, updated_at
      FROM services
      WHERE id = $1;
    `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get service with counters
   */
  static async findByIdWithCounters(id) {
    const serviceSql = `
      SELECT id, name, description, location, is_active,
             estimated_service_time, max_queue_size,
             operating_hours_start, operating_hours_end
      FROM services
      WHERE id = $1;
    `;

    const countersSql = `
      SELECT id, counter_number, name, status, is_active
      FROM counters
      WHERE service_id = $1 AND is_active = true
      ORDER BY counter_number;
    `;

    const [serviceResult, countersResult] = await Promise.all([
      query(serviceSql, [id]),
      query(countersSql, [id]),
    ]);

    const service = serviceResult.rows[0];
    if (!service) return null;

    return {
      ...service,
      counters: countersResult.rows,
    };
  }

  /**
   * Get queue status for a service
   */
  static async getQueueStatus(serviceId) {
    const sql = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'waiting') as waiting_count,
        COUNT(*) FILTER (WHERE status = 'called') as called_count,
        COUNT(*) FILTER (WHERE status = 'serving') as serving_count,
        MIN(queue_position) FILTER (WHERE status = 'waiting') as next_position,
        AVG(estimated_wait_time) FILTER (WHERE status = 'waiting') as avg_wait_time
      FROM queue_entries
      WHERE service_id = $1 AND status IN ('waiting', 'called', 'serving');
    `;

    const result = await query(sql, [serviceId]);
    return result.rows[0] || {
      waiting_count: 0,
      called_count: 0,
      serving_count: 0,
      next_position: null,
      avg_wait_time: null,
    };
  }
}

module.exports = Service;

