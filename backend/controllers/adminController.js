const Queue = require('../models/Queue');
const Service = require('../models/Service');
const Counter = require('../models/Counter');
const User = require('../models/User');
const { query } = require('../config/database');

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Total queues today
    const queuesTodaySql = `
      SELECT COUNT(*) as total
      FROM queue_entries
      WHERE DATE(requested_at) = $1;
    `;
    const queuesTodayResult = await query(queuesTodaySql, [today]);

    // Active queues (waiting, called, serving)
    const activeQueuesSql = `
      SELECT COUNT(*) as total
      FROM queue_entries
      WHERE status IN ('waiting', 'called', 'serving');
    `;
    const activeQueuesResult = await query(activeQueuesSql);

    // Completed queues today
    const completedSql = `
      SELECT COUNT(*) as total
      FROM queue_entries
      WHERE DATE(completed_at) = $1 AND status = 'completed';
    `;
    const completedResult = await query(completedSql, [today]);

    // Average wait time today
    const avgWaitTimeSql = `
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/60) as avg_wait_time
      FROM queue_entries
      WHERE DATE(completed_at) = $1 AND status = 'completed' AND completed_at IS NOT NULL;
    `;
    const avgWaitTimeResult = await query(avgWaitTimeSql, [today]);

    // Service statistics
    const serviceStatsSql = `
      SELECT 
        s.id,
        s.name,
        COUNT(qe.id) as queues_today,
        COUNT(qe.id) FILTER (WHERE qe.status = 'completed' AND DATE(qe.completed_at) = $1) as completed_today,
        AVG(EXTRACT(EPOCH FROM (qe.completed_at - qe.requested_at))/60) 
          FILTER (WHERE qe.status = 'completed' AND DATE(qe.completed_at) = $1) as avg_wait_time
      FROM services s
      LEFT JOIN queue_entries qe ON s.id = qe.service_id AND DATE(qe.requested_at) = $1
      WHERE s.is_active = true
      GROUP BY s.id, s.name
      ORDER BY queues_today DESC;
    `;
    const serviceStatsResult = await query(serviceStatsSql, [today]);

    res.json({
      success: true,
      data: {
        totalQueuesToday: parseInt(queuesTodayResult.rows[0].total) || 0,
        activeQueues: parseInt(activeQueuesResult.rows[0].total) || 0,
        completedQueuesToday: parseInt(completedResult.rows[0].total) || 0,
        averageWaitTime: avgWaitTimeResult.rows[0].avg_wait_time 
          ? Math.round(avgWaitTimeResult.rows[0].avg_wait_time) 
          : null,
        services: serviceStatsResult.rows.map(row => ({
          serviceId: row.id,
          serviceName: row.name,
          queuesToday: parseInt(row.queues_today) || 0,
          completedToday: parseInt(row.completed_today) || 0,
          averageWaitTime: row.avg_wait_time ? Math.round(row.avg_wait_time) : null,
        })),
      },
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching dashboard statistics',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get analytics
 * GET /api/admin/analytics
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, serviceId } = req.query;

    // Build date filter
    let dateFilter = '';
    const params = [];
    let paramCount = 1;

    if (startDate && endDate) {
      dateFilter = `WHERE DATE(requested_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else if (startDate) {
      dateFilter = `WHERE DATE(requested_at) >= $${paramCount}`;
      params.push(startDate);
      paramCount += 1;
    } else {
      // Default to last 30 days
      dateFilter = `WHERE requested_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Add service filter if provided
    if (serviceId) {
      const serviceFilter = dateFilter ? 'AND' : 'WHERE';
      dateFilter += ` ${serviceFilter} service_id = $${paramCount}`;
      params.push(serviceId);
    }

    // Overall statistics
    const overallStatsSql = `
      SELECT 
        COUNT(*) as total_queues,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_queues,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_queues,
        AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/60) 
          FILTER (WHERE status = 'completed') as avg_wait_time,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_serving_at))/60) 
          FILTER (WHERE status = 'completed') as avg_service_time
      FROM queue_entries
      ${dateFilter};
    `;

    // Peak hours analysis
    const peakHoursSql = `
      SELECT 
        EXTRACT(HOUR FROM requested_at) as hour,
        COUNT(*) as queue_count
      FROM queue_entries
      ${dateFilter}
      GROUP BY EXTRACT(HOUR FROM requested_at)
      ORDER BY queue_count DESC
      LIMIT 5;
    `;

    // Service statistics
    const serviceJoinFilter = dateFilter ? dateFilter.replace('WHERE', 'AND') : '';
    const serviceStatsSql = `
      SELECT 
        s.id,
        s.name,
        COUNT(qe.id) as total_queues,
        COUNT(qe.id) FILTER (WHERE qe.status = 'completed') as completed_queues,
        AVG(EXTRACT(EPOCH FROM (qe.completed_at - qe.requested_at))/60) 
          FILTER (WHERE qe.status = 'completed') as avg_wait_time,
        COUNT(qe.id)::FLOAT / NULLIF(COUNT(DISTINCT DATE(qe.requested_at)), 0) as avg_queues_per_day
      FROM services s
      LEFT JOIN queue_entries qe ON s.id = qe.service_id ${serviceJoinFilter}
      WHERE s.is_active = true
      GROUP BY s.id, s.name
      ORDER BY total_queues DESC;
    `;

    const [overallResult, peakHoursResult, serviceStatsResult] = await Promise.all([
      query(overallStatsSql, params),
      query(peakHoursSql, params),
      query(serviceStatsSql, params),
    ]);

    res.json({
      success: true,
      data: {
        totalQueues: parseInt(overallResult.rows[0].total_queues) || 0,
        completedQueues: parseInt(overallResult.rows[0].completed_queues) || 0,
        cancelledQueues: parseInt(overallResult.rows[0].cancelled_queues) || 0,
        averageWaitTime: overallResult.rows[0].avg_wait_time 
          ? Math.round(overallResult.rows[0].avg_wait_time) 
          : null,
        averageServiceTime: overallResult.rows[0].avg_service_time 
          ? Math.round(overallResult.rows[0].avg_service_time) 
          : null,
        peakHours: peakHoursResult.rows.map(row => ({
          hour: parseInt(row.hour),
          queueCount: parseInt(row.queue_count),
        })),
        serviceStatistics: serviceStatsResult.rows.map(row => ({
          serviceId: row.id,
          serviceName: row.name,
          totalQueues: parseInt(row.total_queues) || 0,
          completedQueues: parseInt(row.completed_queues) || 0,
          averageWaitTime: row.avg_wait_time ? Math.round(row.avg_wait_time) : null,
          averageQueuesPerDay: row.avg_queues_per_day 
            ? Math.round(row.avg_queues_per_day * 100) / 100 
            : 0,
        })),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching analytics',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get all users
 * GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT id, student_id, email, first_name, last_name, 
             phone_number, role, is_active, created_at, updated_at
      FROM users
    `;
    const params = [];
    let paramCount = 1;

    if (role) {
      sql += ` WHERE role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM users`;
    const countParams = [];
    if (role) {
      countSql += ` WHERE role = $1`;
      countParams.push(role);
    }

    const [result, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching users',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Update user
 * PUT /api/admin/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, role } = req.body;

    const updateData = {};
    if (is_active !== undefined) updateData.is_active = is_active;
    if (role !== undefined) updateData.role = role;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No valid fields to update',
        },
      });
    }

    const updatedUser = await User.update(id, updateData);

    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating user',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get all services (admin - includes inactive)
 * GET /api/admin/services
 */
exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.findAll(true); // Include inactive

    res.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching services',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Create a new service
 * POST /api/admin/services
 */
exports.createService = async (req, res) => {
  try {
    const {
      name,
      description,
      location,
      estimated_service_time,
      max_queue_size,
      operating_hours_start,
      operating_hours_end,
      is_active,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Service name is required',
        },
      });
    }

    const serviceData = {
      name,
      description,
      location,
      estimated_service_time,
      max_queue_size,
      operating_hours_start,
      operating_hours_end,
      is_active,
    };

    const newService = await Service.create(serviceData);

    // Clear services cache
    const cache = require('../utils/cache');
    cache.delete('services:active');

    res.status(201).json({
      success: true,
      data: newService,
      message: 'Service created successfully',
    });
  } catch (error) {
    console.error('Create service error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: {
          message: 'Service with this name already exists',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating service',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Update a service
 * PUT /api/admin/services/:id
 */
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    }

    const updatedService = await Service.update(id, updateData);

    // Clear services cache
    const cache = require('../utils/cache');
    cache.delete('services:active');

    res.json({
      success: true,
      data: updatedService,
      message: 'Service updated successfully',
    });
  } catch (error) {
    console.error('Update service error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: {
          message: 'Service with this name already exists',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating service',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Delete (deactivate) a service
 * DELETE /api/admin/services/:id
 */
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    }

    const deletedService = await Service.delete(id);
    
    if (!deletedService) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete service',
        },
      });
    }

    // Clear services cache
    const cache = require('../utils/cache');
    cache.delete('services:active');

    res.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error deleting service',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get all counters (admin - includes inactive)
 * GET /api/admin/counters
 */
exports.getAllCounters = async (req, res) => {
  try {
    const counters = await Counter.findAll(true); // Include inactive

    res.json({
      success: true,
      data: counters,
    });
  } catch (error) {
    console.error('Get all counters error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching counters',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Create a new counter
 * POST /api/admin/counters
 */
exports.createCounter = async (req, res) => {
  try {
    const {
      service_id,
      counter_number,
      name,
      status,
      is_active,
    } = req.body;

    if (!service_id || !counter_number) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Service ID and counter number are required',
        },
      });
    }

    // Check if service exists
    const service = await Service.findById(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    }

    const counterData = {
      service_id,
      counter_number,
      name,
      status,
      is_active,
    };

    const newCounter = await Counter.create(counterData);

    // Clear services cache (counters are part of service data)
    const cache = require('../utils/cache');
    cache.delete('services:active');

    res.status(201).json({
      success: true,
      data: newCounter,
      message: 'Counter created successfully',
    });
  } catch (error) {
    console.error('Create counter error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: {
          message: 'Counter with this number already exists for this service',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating counter',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Update a counter
 * PUT /api/admin/counters/:id
 */
exports.updateCounter = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const counter = await Counter.findById(id);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    // If service_id is being updated, verify it exists
    if (updateData.service_id) {
      const service = await Service.findById(updateData.service_id);
      if (!service) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Service not found',
          },
        });
      }
    }

    // Validate status if provided
    if (updateData.status) {
      const allowedStatuses = ['open', 'busy', 'closed', 'break'];
      if (!allowedStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid counter status',
          },
        });
      }
    }

    const updatedCounter = await Counter.update(id, updateData);

    // Clear services cache (counters are part of service data)
    const cache = require('../utils/cache');
    cache.delete('services:active');

    res.json({
      success: true,
      data: updatedCounter,
      message: 'Counter updated successfully',
    });
  } catch (error) {
    console.error('Update counter error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: {
          message: 'Counter with this number already exists for this service',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating counter',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Delete (deactivate) a counter
 * DELETE /api/admin/counters/:id
 */
exports.deleteCounter = async (req, res) => {
  try {
    const { id } = req.params;

    const counter = await Counter.findById(id);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    const deletedCounter = await Counter.delete(id);
    
    if (!deletedCounter) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete counter',
        },
      });
    }

    // Clear services cache (counters are part of service data)
    const cache = require('../utils/cache');
    cache.delete('services:active');

    res.json({
      success: true,
      message: 'Counter deleted successfully',
    });
  } catch (error) {
    console.error('Delete counter error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error deleting counter',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Assign counter to staff members
 * POST /api/admin/counters/:id/assign-staff
 */
exports.assignCounterToStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids, is_primary } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'User IDs array is required',
        },
      });
    }

    const counter = await Counter.findById(id);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    const { query } = require('../config/database');
    
    // Remove existing assignments for this counter
    await query('DELETE FROM counter_staff WHERE counter_id = $1', [id]);

    // Insert new assignments
    const insertPromises = user_ids.map((userId, index) => {
      const primary = is_primary === true && index === 0 ? true : false;
      return query(
        'INSERT INTO counter_staff (user_id, counter_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, counter_id) DO UPDATE SET is_primary = $3',
        [userId, id, primary]
      );
    });

    await Promise.all(insertPromises);

    res.json({
      success: true,
      message: 'Counter assigned to staff successfully',
    });
  } catch (error) {
    console.error('Assign counter to staff error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error assigning counter to staff',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get counter staff assignments
 * GET /api/admin/counters/:id/staff
 */
exports.getCounterStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const counter = await Counter.findById(id);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    const { query } = require('../config/database');
    const result = await query(
      `SELECT cs.*, u.id as user_id, u.first_name, u.last_name, u.email, u.student_id
       FROM counter_staff cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.counter_id = $1
       ORDER BY cs.is_primary DESC, u.first_name`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get counter staff error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching counter staff',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get all queues with filters
 * GET /api/admin/queues
 */
exports.getAllQueues = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      serviceId: req.query.service_id,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
    };

    const result = await Queue.findAll(filters);

    res.json({
      success: true,
      data: result.queues,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get all queues error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching queues',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get display board data (for TV projection)
 * GET /api/admin/display-board
 */
exports.getDisplayBoard = async (req, res) => {
  try {
    const { serviceId } = req.query;

    // Get currently serving queues
    const servingSql = `
      SELECT 
        qe.id, qe.queue_number, qe.queue_position,
        s.name as service_name, s.location as service_location,
        c.counter_number, c.name as counter_name
      FROM queue_entries qe
      JOIN services s ON qe.service_id = s.id
      LEFT JOIN counters c ON qe.counter_id = c.id
      WHERE qe.status = 'serving'
        ${serviceId ? 'AND qe.service_id = $1' : ''}
      ORDER BY qe.started_serving_at DESC;
    `;

    // Get called queues (next in line)
    const calledSql = `
      SELECT 
        qe.id, qe.queue_number, qe.queue_position,
        s.name as service_name, s.location as service_location,
        c.counter_number, c.name as counter_name
      FROM queue_entries qe
      JOIN services s ON qe.service_id = s.id
      LEFT JOIN counters c ON qe.counter_id = c.id
      WHERE qe.status = 'called'
        ${serviceId ? 'AND qe.service_id = $1' : ''}
      ORDER BY qe.called_at DESC
      LIMIT 5;
    `;

    // Get waiting queues count per service
    const waitingSql = `
      SELECT 
        s.id as service_id, s.name as service_name,
        COUNT(qe.id) as waiting_count
      FROM services s
      LEFT JOIN queue_entries qe ON s.id = qe.service_id 
        AND qe.status = 'waiting'
      WHERE s.is_active = true
        ${serviceId ? 'AND s.id = $1' : ''}
      GROUP BY s.id, s.name
      ORDER BY s.name;
    `;

    const queryParams = serviceId ? [serviceId] : [];

    const { query } = require('../config/database');
    
    const [servingResult, calledResult, waitingResult] = await Promise.all([
      query(servingSql, queryParams),
      query(calledSql, queryParams),
      query(waitingSql, queryParams),
    ]);

    res.json({
      success: true,
      data: {
        serving: servingResult.rows,
        called: calledResult.rows,
        waiting: waitingResult.rows,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get display board error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching display board data',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get system settings
 * GET /api/admin/settings
 */
exports.getSystemSettings = async (req, res) => {
  try {
    const cache = require('../utils/cache');
    const cacheKey = 'system:settings';
    
    // Try to get from cache first (settings don't change frequently)
    let cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
      });
    }

    const { query } = require('../config/database');
    
    // Default settings to return if table doesn't exist
    const defaultSettings = {
      queue_number_prefix: '',
      notification_before_minutes: 5,
      auto_refresh_interval: 5,
      display_board_refresh_interval: 5,
      max_queue_per_user: 3,
      enable_sms_notifications: false,
      enable_email_notifications: false,
      system_maintenance_mode: false,
      maintenance_message: '',
    };
    
    try {
      // Check if table exists and if settings exist
      const checkSql = `SELECT COUNT(*) as count FROM system_settings WHERE id = 1;`;
      const checkResult = await query(checkSql);
      
      if (checkResult.rows[0].count === '0') {
        // Create default settings
        const insertSql = `
          INSERT INTO system_settings (id, settings, created_at, updated_at)
          VALUES (1, $1::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING
          RETURNING *;
        `;
        const insertResult = await query(insertSql, [JSON.stringify(defaultSettings)]);
        
        if (insertResult.rows.length > 0) {
          return res.json({
            success: true,
            data: insertResult.rows[0].settings,
          });
        }
        
        // If insert didn't work, try to get existing
        const getSql = `SELECT settings FROM system_settings WHERE id = 1;`;
        const result = await query(getSql);
        
        if (result.rows.length > 0) {
          const settings = result.rows[0].settings;
          // Cache for 10 minutes
          cache.set(cacheKey, settings, 10 * 60 * 1000);
          return res.json({
            success: true,
            data: settings,
          });
        }
      } else {
        // Get existing settings
        const getSql = `SELECT settings FROM system_settings WHERE id = 1;`;
        const result = await query(getSql);
        
        if (result.rows.length > 0) {
          const settings = result.rows[0].settings;
          // Cache for 10 minutes
          cache.set(cacheKey, settings, 10 * 60 * 1000);
          return res.json({
            success: true,
            data: settings,
          });
        }
      }
    } catch (tableError) {
      // Table doesn't exist - return default settings
      console.warn('System settings table not found, returning defaults:', tableError.message);
      // Cache defaults for shorter time (1 minute) in case table is created
      cache.set(cacheKey, defaultSettings, 60 * 1000);
      return res.json({
        success: true,
        data: defaultSettings,
      });
    }
    
    // Fallback to default settings
    cache.set(cacheKey, defaultSettings, 60 * 1000);
    res.json({
      success: true,
      data: defaultSettings,
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching system settings',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Update system settings
 * PUT /api/admin/settings
 */
exports.updateSystemSettings = async (req, res) => {
  try {
    const settings = req.body;
    const { query } = require('../config/database');
    
    try {
      const updateSql = `
        UPDATE system_settings
        SET settings = $1::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        RETURNING settings;
      `;
      
      const result = await query(updateSql, [JSON.stringify(settings)]);
      
      if (result.rows.length > 0) {
        // Invalidate cache when settings are updated
        const cache = require('../utils/cache');
        cache.delete('system:settings');
        
        return res.json({
          success: true,
          data: result.rows[0].settings,
          message: 'System settings updated successfully',
        });
      }
      
      // Create if doesn't exist
      const insertSql = `
        INSERT INTO system_settings (id, settings, created_at, updated_at)
        VALUES (1, $1::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
        RETURNING settings;
      `;
      const insertResult = await query(insertSql, [JSON.stringify(settings)]);
      
      return res.json({
        success: true,
        data: insertResult.rows[0].settings,
        message: 'System settings saved successfully',
      });
    } catch (tableError) {
      // Table doesn't exist - inform user they need to run migration
      console.error('System settings table not found:', tableError.message);
      return res.status(500).json({
        success: false,
        error: {
          message: 'System settings table not found. Please run the database migration to create the system_settings table.',
          ...(process.env.NODE_ENV === 'development' && { detail: tableError.message }),
        },
      });
    }
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating system settings',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Run database migrations
 * POST /api/admin/migrate
 * Requires MIGRATION_SECRET in environment variables
 */
exports.runMigrations = async (req, res) => {
  try {
    // Check for migration secret
    const providedSecret = req.headers['x-migration-secret'] || req.body.secret;
    const expectedSecret = process.env.MIGRATION_SECRET;

    if (!expectedSecret) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Migration secret not configured',
        },
      });
    }

    if (providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid migration secret',
        },
      });
    }

    const fs = require('fs');
    const path = require('path');

    // Embedded SQL migrations (fallback if files not found)
    const embeddedMigrations = {
      '001_create_tables.sql': `-- Create all tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_role CHECK (role IN ('student', 'counter_staff', 'admin'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    estimated_service_time INTEGER DEFAULT 5,
    max_queue_size INTEGER DEFAULT 100,
    operating_hours_start TIME,
    operating_hours_end TIME,
    queue_prefix VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
CREATE TABLE IF NOT EXISTS counters (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    counter_number VARCHAR(10) NOT NULL,
    name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'closed',
    current_serving_queue_id INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_counter_status CHECK (status IN ('open', 'busy', 'closed', 'break')),
    CONSTRAINT unique_counter_per_service UNIQUE (service_id, counter_number)
);
CREATE INDEX IF NOT EXISTS idx_counters_service_id ON counters(service_id);
CREATE INDEX IF NOT EXISTS idx_counters_status ON counters(status);
CREATE TABLE IF NOT EXISTS queue_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    counter_id INTEGER REFERENCES counters(id),
    queue_number VARCHAR(20) NOT NULL,
    queue_position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    estimated_wait_time INTEGER,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP,
    started_serving_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    notes TEXT,
    CONSTRAINT chk_queue_status CHECK (status IN ('waiting', 'called', 'serving', 'completed', 'skipped', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_queue_entries_user_id ON queue_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_service_id ON queue_entries(service_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_counter_id ON queue_entries(counter_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_requested_at ON queue_entries(requested_at);
ALTER TABLE counters ADD CONSTRAINT fk_counters_current_serving_queue_id FOREIGN KEY (current_serving_queue_id) REFERENCES queue_entries(id);
CREATE TABLE IF NOT EXISTS queue_logs (
    id SERIAL PRIMARY KEY,
    queue_entry_id INTEGER NOT NULL REFERENCES queue_entries(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    counter_id INTEGER REFERENCES counters(id),
    action VARCHAR(50) NOT NULL,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_queue_logs_queue_entry_id ON queue_logs(queue_entry_id);
CREATE TABLE IF NOT EXISTS counter_staff (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    counter_id INTEGER NOT NULL REFERENCES counters(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_staff_counter UNIQUE (user_id, counter_id)
);
CREATE INDEX IF NOT EXISTS idx_counter_staff_user_id ON counter_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_counter_staff_counter_id ON counter_staff(counter_id);
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    queue_entry_id INTEGER REFERENCES queue_entries(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    CONSTRAINT chk_notification_type CHECK (type IN ('queue_ready', 'approaching', 'called', 'general', 'system'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`,
      '002_create_system_settings.sql': `CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO system_settings (id, settings)
VALUES (1, '{"queue_number_prefix": "", "notification_before_minutes": 5, "auto_refresh_interval": 5, "display_board_refresh_interval": 5, "max_queue_per_user": 3, "enable_sms_notifications": false, "enable_email_notifications": false, "system_maintenance_mode": false, "maintenance_message": ""}'::jsonb)
ON CONFLICT (id) DO NOTHING;`,
      '003_add_queue_prefix_to_services.sql': `ALTER TABLE services ADD COLUMN IF NOT EXISTS queue_prefix VARCHAR(10);`,
      '004_add_performance_indexes.sql': `CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_queue_entries_service_status ON queue_entries(service_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_user_service ON queue_entries(user_id, service_id, status);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_counters_is_active ON counters(is_active);
CREATE INDEX IF NOT EXISTS idx_counters_service_active ON counters(service_id, is_active);`
    };

    const migrations = [
      '001_create_tables.sql',
      '002_create_system_settings.sql',
      '003_add_queue_prefix_to_services.sql',
      '004_add_performance_indexes.sql',
    ];

    // Try to load from files first, fallback to embedded SQL
    let migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(process.cwd(), '..', 'database', 'migrations');
    }
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    }

    const results = [];

    for (const migrationFile of migrations) {
      let sql = null;
      let source = 'file';

      // Try to read from file
      const filePath = path.join(migrationsDir, migrationFile);
      if (fs.existsSync(filePath)) {
        try {
          sql = fs.readFileSync(filePath, 'utf8');
        } catch (fileError) {
          console.log(`Could not read ${migrationFile} from file, using embedded version`);
        }
      }

      // Fallback to embedded SQL
      if (!sql && embeddedMigrations[migrationFile]) {
        sql = embeddedMigrations[migrationFile];
        source = 'embedded';
      }

      if (!sql) {
        results.push({
          file: migrationFile,
          status: 'error',
          message: 'Migration SQL not found',
        });
        continue;
      }

      try {
        await query(sql);
        results.push({
          file: migrationFile,
          status: 'success',
          message: `Migration completed (${source})`,
        });
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('does not exist')) {
          results.push({
            file: migrationFile,
            status: 'skipped',
            message: 'Already applied or not needed',
          });
        } else {
          results.push({
            file: migrationFile,
            status: 'error',
            message: error.message,
          });
        }
      }
    }

    // Verify tables
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    res.json({
      success: true,
      message: 'Migrations completed',
      results,
      tables: tablesResult.rows.map(row => row.table_name),
    });
  } catch (error) {
    console.error('Run migrations error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error running migrations',
        detail: error.message,
      },
    });
  }
};

/**
 * Seed demo data
 * POST /api/admin/seed
 * Requires MIGRATION_SECRET in environment variables
 */
exports.seedDemoData = async (req, res) => {
  try {
    // Check for migration secret
    const providedSecret = req.headers['x-migration-secret'] || req.body.secret;
    const expectedSecret = process.env.MIGRATION_SECRET;

    if (!expectedSecret) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Migration secret not configured',
        },
      });
    }

    if (providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid migration secret',
        },
      });
    }

    const bcrypt = require('bcrypt');

    // Generate password hash for demo accounts
    const demoPasswordHash = await bcrypt.hash('demo123', 10);

    // Embedded demo data SQL
    const demoSQL = `
-- Insert Demo Users
INSERT INTO users (student_id, email, password_hash, first_name, last_name, role, is_active)
VALUES 
  ('ADMIN001', 'admin@clsu.edu.ph', '${demoPasswordHash}', 'Admin', 'User', 'admin', true),
  ('STAFF001', 'staff1@clsu.edu.ph', '${demoPasswordHash}', 'Maria', 'Santos', 'counter_staff', true),
  ('STAFF002', 'staff2@clsu.edu.ph', '${demoPasswordHash}', 'Juan', 'Dela Cruz', 'counter_staff', true),
  ('2020-12345', 'student1@clsu.edu.ph', '${demoPasswordHash}', 'John', 'Doe', 'student', true),
  ('2020-12346', 'student2@clsu.edu.ph', '${demoPasswordHash}', 'Jane', 'Smith', 'student', true),
  ('2020-12347', 'student3@clsu.edu.ph', '${demoPasswordHash}', 'Michael', 'Johnson', 'student', true),
  ('2020-12348', 'student4@clsu.edu.ph', '${demoPasswordHash}', 'Sarah', 'Williams', 'student', true),
  ('2020-12349', 'student5@clsu.edu.ph', '${demoPasswordHash}', 'David', 'Brown', 'student', true)
ON CONFLICT (email) DO NOTHING;

-- Insert Demo Services
INSERT INTO services (name, description, location, estimated_service_time, max_queue_size, is_active, queue_prefix)
VALUES 
  ('Registrar', 'Student registration, transcript requests, and academic records', 'Main Building, 2nd Floor', 10, 100, true, 'REG'),
  ('Cashier', 'Tuition payments, fees, and financial transactions', 'Administration Building, 1st Floor', 5, 150, true, 'CAS'),
  ('Clinic', 'Medical consultations and health services', 'Health Center', 15, 50, true, 'CLI'),
  ('Library', 'Book borrowing, research assistance, and library services', 'Library Building', 8, 80, true, 'LIB'),
  ('Guidance Office', 'Counseling services and student support', 'Student Affairs Building', 20, 30, true, 'GUD'),
  ('Admission Office', 'Admission inquiries and application processing', 'Administration Building, 1st Floor', 12, 60, true, 'ADM')
ON CONFLICT (name) DO NOTHING;

-- Insert Demo Counters
INSERT INTO counters (service_id, counter_number, name, status, is_active)
SELECT 
  s.id,
  counter_num::text,
  s.name || ' Counter ' || counter_num,
  'open',
  true
FROM services s
CROSS JOIN generate_series(1, 2) AS counter_num
WHERE s.is_active = true
ON CONFLICT DO NOTHING;

-- Assign Counter Staff to Counters
INSERT INTO counter_staff (counter_id, user_id, assigned_at)
SELECT 
  c.id,
  u.id,
  CURRENT_TIMESTAMP
FROM counters c
JOIN services s ON c.service_id = s.id
JOIN users u ON u.role = 'counter_staff'
WHERE c.counter_number = '1'
LIMIT (SELECT COUNT(*) FROM counters WHERE counter_number = '1')
ON CONFLICT DO NOTHING;

-- Insert Demo Queue Entries
INSERT INTO queue_entries (user_id, service_id, queue_number, queue_position, status, requested_at, estimated_wait_time)
WITH numbered_entries AS (
  SELECT 
    u.id as user_id,
    s.id as service_id,
    COALESCE(s.queue_prefix, SUBSTRING(s.name FROM 1 FOR 3)) as prefix,
    s.estimated_service_time,
    ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY u.id) as row_num
  FROM users u
  CROSS JOIN services s
  WHERE u.role = 'student' 
    AND s.is_active = true
)
SELECT 
  user_id,
  service_id,
  UPPER(prefix) || '-' || LPAD(row_num::text, 3, '0'),
  row_num,
  CASE 
    WHEN row_num = 1 THEN 'serving'
    WHEN row_num <= 3 THEN 'called'
    ELSE 'waiting'
  END,
  CURRENT_TIMESTAMP - (INTERVAL '1 hour' * row_num),
  estimated_service_time * row_num
FROM numbered_entries
WHERE row_num <= 5
ON CONFLICT DO NOTHING;

-- Update System Settings
INSERT INTO system_settings (id, settings, created_at, updated_at)
VALUES (
  1,
  '{"queue_number_prefix": "", "notification_before_minutes": 5, "auto_refresh_interval": 5, "display_board_refresh_interval": 5, "max_queue_per_user": 3, "enable_sms_notifications": false, "enable_email_notifications": false, "system_maintenance_mode": false, "maintenance_message": ""}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE
SET settings = EXCLUDED.settings,
    updated_at = CURRENT_TIMESTAMP;
`;

    // Execute SQL statements
    const statements = demoSQL.split(';').filter(s => s.trim().length > 0);
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        try {
          await query(statement);
        } catch (error) {
          // Ignore conflicts and duplicate errors
          if (!error.message.includes('already exists') && 
              !error.message.includes('duplicate') &&
              !error.message.includes('violates unique constraint')) {
            console.error('Error executing statement:', error.message);
          }
        }
      }
    }

    // Get summary
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const serviceCount = await query('SELECT COUNT(*) as count FROM services');
    const counterCount = await query('SELECT COUNT(*) as count FROM counters');
    const queueCount = await query('SELECT COUNT(*) as count FROM queue_entries');

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      summary: {
        users: parseInt(userCount.rows[0].count),
        services: parseInt(serviceCount.rows[0].count),
        counters: parseInt(counterCount.rows[0].count),
        queueEntries: parseInt(queueCount.rows[0].count),
      },
      credentials: {
        admin: 'admin@clsu.edu.ph / demo123',
        staff: 'staff1@clsu.edu.ph / demo123',
        student: 'student1@clsu.edu.ph / demo123',
      },
    });
  } catch (error) {
    console.error('Seed demo data error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error seeding demo data',
        detail: error.message,
      },
    });
  }
};

