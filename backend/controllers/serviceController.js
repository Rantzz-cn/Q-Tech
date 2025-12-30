const Service = require('../models/Service');
const Queue = require('../models/Queue');

/**
 * Get system settings helper
 */
const getSystemSettings = async () => {
  try {
    const { query } = require('../config/database');
    const sql = `SELECT settings FROM system_settings WHERE id = 1;`;
    const result = await query(sql);
    
    if (result.rows.length > 0) {
      return result.rows[0].settings;
    }
    
    return {
      system_maintenance_mode: false,
      maintenance_message: '',
    };
  } catch (error) {
    return {
      system_maintenance_mode: false,
      maintenance_message: '',
    };
  }
};

/**
 * Get all services
 * GET /api/services
 */
exports.getAllServices = async (req, res) => {
  try {
    const cache = require('../utils/cache');
    const cacheKey = 'services:active';
    
    // Try to get from cache first
    let cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const services = await Service.findAll(false); // Only active services for public endpoint
    const systemSettings = await getSystemSettings();

    const response = {
      success: true,
      data: services,
      maintenance: {
        enabled: systemSettings.system_maintenance_mode === true,
        message: systemSettings.maintenance_message || '',
      },
    };

    // Cache for 5 minutes (services don't change frequently)
    cache.set(cacheKey, response, 5 * 60 * 1000);

    res.json(response);
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching services',
        detail: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    });
  }
};

/**
 * Get service by ID
 * GET /api/services/:id
 */
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByIdWithCounters(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('Get service by ID error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching service',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get service queue status
 * GET /api/services/:id/queue-status
 */
exports.getServiceQueueStatus = async (req, res) => {
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

    const queueStatus = await Service.getQueueStatus(id);
    const queueEntries = await Queue.getServiceQueueStatus(id);

    const currentServing = queueEntries.find(q => q.status === 'serving')?.queue_number || null;

    res.json({
      success: true,
      data: {
        serviceId: parseInt(id),
        serviceName: service.name,
        currentServing,
        waitingCount: parseInt(queueStatus.waiting_count) || 0,
        calledCount: parseInt(queueStatus.called_count) || 0,
        servingCount: parseInt(queueStatus.serving_count) || 0,
        averageWaitTime: queueStatus.avg_wait_time ? Math.round(queueStatus.avg_wait_time) : null,
      },
    });
  } catch (error) {
    console.error('Get service queue status error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching service queue status',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

