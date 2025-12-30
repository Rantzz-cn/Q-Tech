const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const Service = require('../models/Service');
const QueueEvents = require('../socket/queueEvents');

/**
 * Get all counters
 * GET /api/counters
 */
exports.getAllCounters = async (req, res) => {
  try {
    const counters = await Counter.findAll();

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
 * Get counters for current staff member
 * GET /api/counters/my-counters
 */
exports.getMyCounters = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user is counter staff or admin
    if (req.user.role !== 'counter_staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Counter staff only.',
        },
      });
    }

    const counters = await Counter.findByStaffId(userId);

    res.json({
      success: true,
      data: counters,
    });
  } catch (error) {
    console.error('Get my counters error:', error);
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
 * Get counter by ID
 * GET /api/counters/:id
 */
exports.getCounterById = async (req, res) => {
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

    // Get current serving queue if any
    let currentServing = null;
    if (counter.current_serving_queue_id) {
      currentServing = await Queue.findById(counter.current_serving_queue_id);
    }

    // Get queue status for this counter's service
    const queueStatus = await Service.getQueueStatus(counter.service_id);

    res.json({
      success: true,
      data: {
        ...counter,
        currentServing: currentServing ? {
          id: currentServing.id,
          queueNumber: currentServing.queue_number,
          status: currentServing.status,
        } : null,
        queueStatus: {
          waitingCount: parseInt(queueStatus.waiting_count) || 0,
          calledCount: parseInt(queueStatus.called_count) || 0,
          servingCount: parseInt(queueStatus.serving_count) || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get counter by ID error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching counter',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Call next queue number
 * POST /api/counters/:counterId/call-next
 */
exports.callNext = async (req, res) => {
  try {
    const { counterId } = req.params;
    const userId = req.user.userId;

    // Check if user is counter staff or admin
    if (req.user.role !== 'counter_staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Counter staff only.',
        },
      });
    }

    // Get counter
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    // Check if counter is open
    if (counter.status === 'closed') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Counter is closed',
        },
      });
    }

    // Get next waiting queue
    const nextQueue = await Counter.getNextWaitingQueue(counter.service_id);

    if (!nextQueue) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'No waiting queues available',
        },
      });
    }

    // Update queue status to 'called'
    const { query } = require('../config/database');
    const updateQueueSql = `
      UPDATE queue_entries
      SET status = 'called',
          counter_id = $1,
          called_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const queueResult = await query(updateQueueSql, [counterId, nextQueue.id]);
    const updatedQueue = queueResult.rows[0];

    // Update counter's current serving
    await Counter.setCurrentServing(counterId, updatedQueue.id);

    // Update counter status to 'busy'
    await Counter.updateStatus(counterId, 'busy');

    // Log the action
    await Queue.logQueueAction(
      updatedQueue.id,
      counter.service_id,
      counterId,
      'called'
    );

    // Emit WebSocket event
    await QueueEvents.emitQueueCalled(updatedQueue, counter);

    res.json({
      success: true,
      data: {
        queueId: updatedQueue.id,
        queueNumber: updatedQueue.queue_number,
        queuePosition: updatedQueue.queue_position,
        message: `Queue ${updatedQueue.queue_number} called to Counter ${counter.counter_number}`,
      },
    });
  } catch (error) {
    console.error('Call next error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error calling next queue',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Start serving a queue (mark as serving)
 * POST /api/counters/:counterId/start-serving/:queueId
 */
exports.startServing = async (req, res) => {
  try {
    const { counterId, queueId } = req.params;
    const userId = req.user.userId;

    // Check if user is counter staff or admin
    if (req.user.role !== 'counter_staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Counter staff only.',
        },
      });
    }

    // Get counter
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    // Get queue entry
    const queueEntry = await Queue.findById(queueId);
    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Queue entry not found',
        },
      });
    }

    // Verify queue is assigned to this counter
    if (queueEntry.counter_id !== parseInt(counterId)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Queue entry is not assigned to this counter',
        },
      });
    }

    // Update queue status to 'serving'
    const { query } = require('../config/database');
    const updateSql = `
      UPDATE queue_entries
      SET status = 'serving',
          started_serving_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(updateSql, [queueId]);
    const updatedQueue = result.rows[0];

    // Log the action
    await Queue.logQueueAction(
      queueId,
      counter.service_id,
      counterId,
      'started'
    );

    // Emit WebSocket event
    await QueueEvents.emitQueueServingStarted(updatedQueue, counter);

    res.json({
      success: true,
      data: {
        queueId: updatedQueue.id,
        queueNumber: updatedQueue.queue_number,
        status: updatedQueue.status,
        message: 'Service started',
      },
    });
  } catch (error) {
    console.error('Start serving error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error starting service',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Complete queue service
 * POST /api/counters/:counterId/complete/:queueId
 */
exports.completeService = async (req, res) => {
  try {
    const { counterId, queueId } = req.params;
    const userId = req.user.userId;

    // Check if user is counter staff or admin
    if (req.user.role !== 'counter_staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Counter staff only.',
        },
      });
    }

    // Get counter
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    // Get queue entry
    const queueEntry = await Queue.findById(queueId);
    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Queue entry not found',
        },
      });
    }

    // Verify queue is assigned to this counter
    if (queueEntry.counter_id !== parseInt(counterId)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Queue entry is not assigned to this counter',
        },
      });
    }

    // Update queue status to 'completed'
    const { query } = require('../config/database');
    const updateSql = `
      UPDATE queue_entries
      SET status = 'completed',
          completed_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(updateSql, [queueId]);
    const updatedQueue = result.rows[0];

    // Clear counter's current serving
    await Counter.setCurrentServing(counterId, null);

    // Update counter status back to 'open'
    await Counter.updateStatus(counterId, 'open');

    // Log the action
    await Queue.logQueueAction(
      queueId,
      counter.service_id,
      counterId,
      'completed'
    );

    // Emit WebSocket event
    await QueueEvents.emitQueueCompleted(updatedQueue, counter);

    res.json({
      success: true,
      data: {
        queueId: updatedQueue.id,
        queueNumber: updatedQueue.queue_number,
        status: updatedQueue.status,
        message: 'Service completed successfully',
      },
    });
  } catch (error) {
    console.error('Complete service error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error completing service',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Update counter status
 * POST /api/counters/:counterId/status
 */
exports.updateCounterStatus = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    // Check if user is counter staff or admin
    if (req.user.role !== 'counter_staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Counter staff only.',
        },
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Status is required',
        },
      });
    }

    const updatedCounter = await Counter.updateStatus(counterId, status);

    res.json({
      success: true,
      data: updatedCounter,
      message: `Counter status updated to ${status}`,
    });
  } catch (error) {
    console.error('Update counter status error:', error);
    
    if (error.message === 'Invalid counter status') {
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
        message: 'Error updating counter status',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get counter statistics
 * GET /api/counters/:counterId/stats
 */
exports.getCounterStats = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { date } = req.query;
    const userId = req.user.userId;

    // Check if user is counter staff or admin
    if (req.user.role !== 'counter_staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Counter staff only.',
        },
      });
    }

    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Counter not found',
        },
      });
    }

    const stats = await Counter.getCounterStats(counterId, date);

    res.json({
      success: true,
      data: {
        counterId: parseInt(counterId),
        counterNumber: counter.counter_number,
        serviceName: counter.service_name,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Get counter stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching counter statistics',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

