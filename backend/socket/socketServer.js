const { Server } = require('socket.io');

/**
 * Socket.IO Server Setup
 * Handles real-time WebSocket connections
 */
class SocketServer {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // In production, specify your frontend URL
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();

    console.log('🔌 WebSocket server initialized');
    return this.io;
  }

  /**
   * Setup Socket.IO middleware for authentication
   */
  setupMiddleware() {
    this.io.use((socket, next) => {
      // For now, we'll allow all connections
      // In production, you might want to verify JWT tokens here
      next();
    });
  }

  /**
   * Setup connection handlers
   */
  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Handle joining service room
      socket.on('join_service', (data) => {
        const { serviceId } = data;
        if (serviceId) {
          socket.join(`service:${serviceId}`);
          console.log(`👤 Socket ${socket.id} joined service:${serviceId}`);
        }
      });

      // Handle leaving service room
      socket.on('leave_service', (data) => {
        const { serviceId } = data;
        if (serviceId) {
          socket.leave(`service:${serviceId}`);
          console.log(`👤 Socket ${socket.id} left service:${serviceId}`);
        }
      });

      // Handle joining counter room
      socket.on('join_counter', (data) => {
        const { counterId } = data;
        if (counterId) {
          socket.join(`counter:${counterId}`);
          console.log(`👤 Socket ${socket.id} joined counter:${counterId}`);
        }
      });

      // Handle joining user room (for personal notifications)
      socket.on('join_user', (data) => {
        const { userId } = data;
        if (userId) {
          socket.join(`user:${userId}`);
          console.log(`👤 Socket ${socket.id} joined user:${userId}`);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Emit queue update to a service room
   */
  emitQueueUpdate(serviceId, data) {
    if (this.io) {
      this.io.to(`service:${serviceId}`).emit('queue_update', data);
      console.log(`📢 Queue update emitted to service:${serviceId}`);
    }
  }

  /**
   * Emit queue called notification to specific user
   */
  emitQueueCalled(userId, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('queue_called', data);
      console.log(`📢 Queue called notification sent to user:${userId}`);
    }
  }

  /**
   * Emit counter status update
   */
  emitCounterUpdate(counterId, data) {
    if (this.io) {
      this.io.to(`counter:${counterId}`).emit('counter_update', data);
      this.io.to(`service:${data.serviceId}`).emit('counter_update', data);
      console.log(`📢 Counter update emitted for counter:${counterId}`);
    }
  }

  /**
   * Emit service status update
   */
  emitServiceStatusUpdate(serviceId, data) {
    if (this.io) {
      this.io.to(`service:${serviceId}`).emit('service_status_update', data);
      console.log(`📢 Service status update emitted for service:${serviceId}`);
    }
  }

  /**
   * Get IO instance
   */
  getIO() {
    return this.io;
  }
}

// Export singleton instance
const socketServer = new SocketServer();
module.exports = socketServer;

