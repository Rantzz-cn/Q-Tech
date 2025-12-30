const Queue = require('../models/Queue');
const Service = require('../models/Service');
const QueueEvents = require('../socket/queueEvents');

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
    
    // Return default settings if not found
    return {
      system_maintenance_mode: false,
      maintenance_message: '',
    };
  } catch (error) {
    // If table doesn't exist, return defaults
    return {
      system_maintenance_mode: false,
      maintenance_message: '',
    };
  }
};

/**
 * Request a queue number
 * POST /api/queue/request
 */
exports.requestQueue = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { serviceId } = req.body;

    // Validation
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Service ID is required',
        },
      });
    }

    // Check system maintenance mode
    const systemSettings = await getSystemSettings();
    if (systemSettings.system_maintenance_mode === true) {
      return res.status(503).json({
        success: false,
        error: {
          message: systemSettings.maintenance_message || 'System is currently under maintenance. Please try again later.',
          maintenanceMode: true,
        },
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service || !service.is_active) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Service not found or inactive',
        },
      });
    }

    // Check if user already has an active queue for this service
    const existingQueue = await Queue.findByUserAndService(userId, serviceId);
    if (existingQueue) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'You already have an active queue for this service',
          queueId: existingQueue.id,
        },
      });
    }

    // Create queue entry
    const queueEntry = await Queue.create({
      userId,
      serviceId,
    });

    // Emit WebSocket event
    await QueueEvents.emitQueueCreated(queueEntry);

    res.status(201).json({
      success: true,
      data: {
        id: queueEntry.id,
        queueNumber: queueEntry.queue_number,
        queuePosition: queueEntry.queue_position,
        serviceId: queueEntry.service_id,
        serviceName: service.name,
        estimatedWaitTime: queueEntry.estimated_wait_time,
        status: queueEntry.status,
        requestedAt: queueEntry.requested_at,
      },
    });
  } catch (error) {
    console.error('Request queue error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating queue entry',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get queue status
 * GET /api/queue/:queueId
 */
exports.getQueueStatus = async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = req.user.userId;

    const queueEntry = await Queue.findById(queueId);

    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Queue entry not found',
        },
      });
    }

    // Check if user owns this queue entry
    if (queueEntry.user_id !== userId && req.user.role !== 'admin' && req.user.role !== 'counter_staff') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: queueEntry.id,
        queueNumber: queueEntry.queue_number,
        queuePosition: queueEntry.queue_position,
        serviceId: queueEntry.service_id,
        serviceName: queueEntry.service_name,
        serviceLocation: queueEntry.service_location,
        status: queueEntry.status,
        estimatedWaitTime: queueEntry.estimated_wait_time,
        requestedAt: queueEntry.requested_at,
        calledAt: queueEntry.called_at,
        startedServingAt: queueEntry.started_serving_at,
        completedAt: queueEntry.completed_at,
      },
    });
  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching queue status',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get service queue status
 * GET /api/queue/status/:serviceId
 */
exports.getServiceQueueStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Get service details
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    }

    // Get queue status
    const queueStatus = await Service.getQueueStatus(serviceId);
    const queueEntries = await Queue.getServiceQueueStatus(serviceId);

    // Get current serving number
    const currentServing = queueEntries.find(q => q.status === 'serving')?.queue_number || null;

    res.json({
      success: true,
      data: {
        serviceId: parseInt(serviceId),
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

/**
 * Cancel queue entry
 * DELETE /api/queue/:queueId/cancel
 */
exports.cancelQueue = async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = req.user.userId;

    const cancelledQueue = await Queue.cancel(queueId, userId);

    // Emit WebSocket event
    await QueueEvents.emitQueueCancelled(cancelledQueue);

    res.json({
      success: true,
      message: 'Queue cancelled successfully',
      data: {
        id: cancelledQueue.id,
        queueNumber: cancelledQueue.queue_number,
        status: cancelledQueue.status,
      },
    });
  } catch (error) {
    console.error('Cancel queue error:', error);
    
    if (error.message.includes('not found') || error.message.includes('cannot be cancelled')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error cancelling queue',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get user's queue history
 * GET /api/queue/history
 */
exports.getQueueHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await Queue.getUserHistory(userId, limit, offset);

    res.json({
      success: true,
      data: {
        queues: result.queues.map(q => ({
          id: q.id,
          queueNumber: q.queue_number,
          serviceName: q.service_name,
          status: q.status,
          requestedAt: q.requested_at,
          completedAt: q.completed_at,
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get queue history error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching queue history',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

