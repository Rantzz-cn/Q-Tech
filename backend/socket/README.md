# WebSocket Real-Time Features

This directory contains the WebSocket/real-time functionality for CLSU NEXUS.

## Files

- `socketServer.js` - Socket.IO server setup and configuration
- `queueEvents.js` - Event handlers for queue-related WebSocket events

## How It Works

### Socket.IO Setup

The WebSocket server is initialized in `server.js` and handles real-time connections.

### Events

#### Client → Server Events

1. **join_service** - Client joins a service room to receive queue updates
   ```javascript
   socket.emit('join_service', { serviceId: 1 });
   ```

2. **leave_service** - Client leaves a service room
   ```javascript
   socket.emit('leave_service', { serviceId: 1 });
   ```

3. **join_counter** - Client joins a counter room (for staff)
   ```javascript
   socket.emit('join_counter', { counterId: 1 });
   ```

4. **join_user** - Client joins their personal user room (for notifications)
   ```javascript
   socket.emit('join_user', { userId: 123 });
   ```

#### Server → Client Events

1. **queue_update** - Queue status update for a service
   ```javascript
   socket.on('queue_update', (data) => {
     // data contains: type, queueNumber, queuePosition, waitingCount, currentServing, etc.
   });
   ```

2. **queue_called** - Personal notification when user's queue is called
   ```javascript
   socket.on('queue_called', (data) => {
     // data contains: type, queueNumber, counterNumber, counterName, message
   });
   ```

3. **counter_update** - Counter status update
   ```javascript
   socket.on('counter_update', (data) => {
     // data contains: type, counterId, serviceId, queueNumber, status
   });
   ```

4. **service_status_update** - Service status update
   ```javascript
   socket.on('service_status_update', (data) => {
     // data contains service status information
   });
   ```

## Usage Example (Client Side)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

// Join service room
socket.emit('join_service', { serviceId: 1 });

// Listen for queue updates
socket.on('queue_update', (data) => {
  console.log('Queue update:', data);
  // Update UI with new queue status
});

// Join user room for personal notifications
socket.emit('join_user', { userId: currentUserId });

socket.on('queue_called', (data) => {
  console.log('Your queue was called!', data);
  // Show notification to user
});
```

## Rooms

- `service:{serviceId}` - All users watching a specific service
- `counter:{counterId}` - Counter staff monitoring a counter
- `user:{userId}` - Individual user notifications

