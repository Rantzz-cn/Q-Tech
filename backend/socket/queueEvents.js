const socketServer = require('./socketServer');
const Service = require('../models/Service');
const Queue = require('../models/Queue');

/**
 * Queue Events Helper
 * Handles emitting WebSocket events for queue-related actions
 */
class QueueEvents {
  /**
   * Emit queue created event
   */
  static async emitQueueCreated(queueEntry) {
    try {
      const serviceId = queueEntry.service_id;

      // Get updated service queue status
      const queueStatus = await Service.getQueueStatus(serviceId);
      const queueEntries = await Queue.getServiceQueueStatus(serviceId);

      socketServer.emitQueueUpdate(serviceId, {
        type: 'queue_created',
        queueNumber: queueEntry.queue_number,
        queuePosition: queueEntry.queue_position,
        waitingCount: parseInt(queueStatus.waiting_count) || 0,
        currentServing: queueEntries.find(q => q.status === 'serving')?.queue_number || null,
        timestamp: new Date().toISOString(),
      });

      // Also notify the user who created the queue
      socketServer.emitQueueCalled(queueEntry.user_id, {
        type: 'queue_created',
        queueNumber: queueEntry.queue_number,
        queuePosition: queueEntry.queue_position,
        serviceId: serviceId,
        estimatedWaitTime: queueEntry.estimated_wait_time,
      });
    } catch (error) {
      console.error('Error emitting queue created event:', error);
    }
  }

  /**
   * Emit queue called event
   */
  static async emitQueueCalled(queueEntry, counter) {
    try {
      const serviceId = queueEntry.service_id;
      const counterId = counter.id;

      // Get updated service queue status
      const queueStatus = await Service.getQueueStatus(serviceId);
      const queueEntries = await Queue.getServiceQueueStatus(serviceId);

      // Emit to service room
      socketServer.emitQueueUpdate(serviceId, {
        type: 'queue_called',
        queueNumber: queueEntry.queue_number,
        queuePosition: queueEntry.queue_position,
        counterNumber: counter.counter_number,
        counterName: counter.name,
        waitingCount: parseInt(queueStatus.waiting_count) || 0,
        currentServing: queueEntry.queue_number,
        timestamp: new Date().toISOString(),
      });

      // Emit counter update
      socketServer.emitCounterUpdate(counterId, {
        type: 'queue_called',
        counterId: counterId,
        serviceId: serviceId,
        queueNumber: queueEntry.queue_number,
        queueId: queueEntry.id,
        status: 'busy',
      });

      // Notify the specific user
      socketServer.emitQueueCalled(queueEntry.user_id, {
        type: 'queue_called',
        queueNumber: queueEntry.queue_number,
        counterNumber: counter.counter_number,
        counterName: counter.name,
        message: `Queue ${queueEntry.queue_number} called to Counter ${counter.counter_number}`,
      });
    } catch (error) {
      console.error('Error emitting queue called event:', error);
    }
  }

  /**
   * Emit queue serving started event
   */
  static async emitQueueServingStarted(queueEntry, counter) {
    try {
      const serviceId = queueEntry.service_id;
      const counterId = counter.id;

      socketServer.emitQueueUpdate(serviceId, {
        type: 'queue_serving',
        queueNumber: queueEntry.queue_number,
        counterNumber: counter.counter_number,
        currentServing: queueEntry.queue_number,
        timestamp: new Date().toISOString(),
      });

      socketServer.emitCounterUpdate(counterId, {
        type: 'serving_started',
        counterId: counterId,
        serviceId: serviceId,
        queueNumber: queueEntry.queue_number,
        queueId: queueEntry.id,
      });
    } catch (error) {
      console.error('Error emitting queue serving started event:', error);
    }
  }

  /**
   * Emit queue completed event
   */
  static async emitQueueCompleted(queueEntry, counter) {
    try {
      const serviceId = queueEntry.service_id;
      const counterId = counter.id;

      // Get updated service queue status
      const queueStatus = await Service.getQueueStatus(serviceId);
      const queueEntries = await Queue.getServiceQueueStatus(serviceId);

      // Emit to service room
      socketServer.emitQueueUpdate(serviceId, {
        type: 'queue_completed',
        queueNumber: queueEntry.queue_number,
        waitingCount: parseInt(queueStatus.waiting_count) || 0,
        currentServing: queueEntries.find(q => q.status === 'serving')?.queue_number || null,
        timestamp: new Date().toISOString(),
      });

      // Emit counter update (counter is now open)
      socketServer.emitCounterUpdate(counterId, {
        type: 'queue_completed',
        counterId: counterId,
        serviceId: serviceId,
        queueNumber: queueEntry.queue_number,
        status: 'open',
      });

      // Notify the user
      socketServer.emitQueueCalled(queueEntry.user_id, {
        type: 'queue_completed',
        queueNumber: queueEntry.queue_number,
        message: `Thank you! Your service for queue ${queueEntry.queue_number} has been completed.`,
      });
    } catch (error) {
      console.error('Error emitting queue completed event:', error);
    }
  }

  /**
   * Emit queue cancelled event
   */
  static async emitQueueCancelled(queueEntry) {
    try {
      const serviceId = queueEntry.service_id;

      // Get updated service queue status
      const queueStatus = await Service.getQueueStatus(serviceId);
      const queueEntries = await Queue.getServiceQueueStatus(serviceId);

      socketServer.emitQueueUpdate(serviceId, {
        type: 'queue_cancelled',
        queueNumber: queueEntry.queue_number,
        waitingCount: parseInt(queueStatus.waiting_count) || 0,
        currentServing: queueEntries.find(q => q.status === 'serving')?.queue_number || null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error emitting queue cancelled event:', error);
    }
  }
}

module.exports = QueueEvents;

