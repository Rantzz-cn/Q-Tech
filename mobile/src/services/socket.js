import io from 'socket.io-client';
import { WS_URL } from '../constants/config';

/**
 * WebSocket Client Service
 * Handles real-time WebSocket connections
 */

let socket = null;

/**
 * Initialize and connect to WebSocket server
 */
export const connectSocket = () => {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  return socket;
};

/**
 * Disconnect from WebSocket server
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a service room to receive queue updates
 */
export const joinServiceRoom = (serviceId) => {
  if (socket) {
    socket.emit('join_service', { serviceId });
    console.log(`[WebSocket] Joined service room: ${serviceId}`);
  }
};

/**
 * Leave a service room
 */
export const leaveServiceRoom = (serviceId) => {
  if (socket) {
    socket.emit('leave_service', { serviceId });
    console.log(`[WebSocket] Left service room: ${serviceId}`);
  }
};

/**
 * Join user room for personal notifications
 */
export const joinUserRoom = (userId) => {
  if (socket) {
    socket.emit('join_user', { userId });
    console.log(`[WebSocket] Joined user room: ${userId}`);
  }
};

/**
 * Subscribe to queue update events
 */
export const onQueueUpdate = (callback) => {
  if (socket) {
    socket.on('queue_update', callback);
  }
};

/**
 * Unsubscribe from queue update events
 */
export const offQueueUpdate = (callback) => {
  if (socket) {
    socket.off('queue_update', callback);
  }
};

/**
 * Subscribe to queue called events (personal notifications)
 */
export const onQueueCalled = (callback) => {
  if (socket) {
    socket.on('queue_called', callback);
  }
};

/**
 * Unsubscribe from queue called events
 */
export const offQueueCalled = (callback) => {
  if (socket) {
    socket.off('queue_called', callback);
  }
};

/**
 * Get socket instance
 */
export const getSocket = () => {
  return socket;
};

