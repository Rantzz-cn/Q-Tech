# Q-Tech - API Documentation

## Base URL
```
Development: http://localhost:3000/api
Production: https://q-tech.vercel.app/
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### Register User
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "studentId": "2020-12345",
  "email": "student@clsu.edu.ph",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "09123456789"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "studentId": "2020-12345",
      "email": "student@clsu.edu.ph",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "student@clsu.edu.ph",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "studentId": "2020-12345",
      "email": "student@clsu.edu.ph",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Get Current User
```
GET /api/auth/me
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "studentId": "2020-12345",
    "email": "student@clsu.edu.ph",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  }
}
```

---

## Queue Endpoints

### Request Queue Number
```
POST /api/queue/request
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "serviceId": 1
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "queueNumber": "REG-001",
    "queuePosition": 5,
    "serviceId": 1,
    "serviceName": "Registrar",
    "estimatedWaitTime": 25,
    "status": "waiting",
    "requestedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Get Queue Status
```
GET /api/queue/:queueId
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "queueNumber": "REG-001",
    "queuePosition": 3,
    "serviceId": 1,
    "serviceName": "Registrar",
    "estimatedWaitTime": 15,
    "status": "waiting",
    "requestedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Get Service Queue Status
```
GET /api/queue/status/:serviceId
```

**Query Parameters:**
- None

**Response (200):**
```json
{
  "success": true,
  "data": {
    "serviceId": 1,
    "serviceName": "Registrar",
    "currentServing": "REG-045",
    "waitingCount": 12,
    "averageWaitTime": 20,
    "counters": [
      {
        "id": 1,
        "counterNumber": "1",
        "status": "open",
        "currentServing": "REG-045"
      }
    ]
  }
}
```

---

### Cancel Queue
```
DELETE /api/queue/:queueId/cancel
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Queue cancelled successfully"
}
```

---

### Get Queue History
```
GET /api/queue/history
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (completed, cancelled, etc.)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "queues": [
      {
        "id": 123,
        "queueNumber": "REG-001",
        "serviceName": "Registrar",
        "status": "completed",
        "requestedAt": "2024-01-15T10:30:00Z",
        "completedAt": "2024-01-15T10:55:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

---

## Service Endpoints

### Get All Services
```
GET /api/services
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Registrar",
      "description": "Enrollment and transcript services",
      "location": "Administration Building",
      "estimatedServiceTime": 10,
      "isActive": true
    }
  ]
}
```

---

### Get Service Details
```
GET /api/services/:id
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Registrar",
    "description": "Enrollment and transcript services",
    "location": "Administration Building",
    "estimatedServiceTime": 10,
    "isActive": true,
    "counters": [
      {
        "id": 1,
        "counterNumber": "1",
        "status": "open"
      }
    ]
  }
}
```

---

### Get Service Queue Status
```
GET /api/services/:id/queue-status
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "serviceId": 1,
    "waitingCount": 12,
    "currentServing": "REG-045",
    "averageWaitTime": 20,
    "counters": [
      {
        "id": 1,
        "counterNumber": "1",
        "status": "open",
        "currentServing": "REG-045"
      }
    ]
  }
}
```

---

## Counter Endpoints

### Get All Counters (Admin/Counter Staff)
```
GET /api/counters
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "serviceId": 1,
      "serviceName": "Registrar",
      "counterNumber": "1",
      "status": "open",
      "currentServingQueueId": 123,
      "currentServing": "REG-045"
    }
  ]
}
```

---

### Call Next Queue Number
```
POST /api/counters/:counterId/call-next
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "queueId": 123,
    "queueNumber": "REG-046",
    "queuePosition": 1,
    "message": "Next number called successfully"
  }
}
```

---

### Update Counter Status
```
POST /api/counters/:counterId/status
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "busy"  // open, busy, closed, break
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Counter status updated successfully"
}
```

---

### Complete Queue Service
```
POST /api/queue/:queueId/complete
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Service completed successfully"
}
```

---

## Admin Endpoints

### Get Dashboard Statistics
```
GET /api/admin/dashboard
```

**Headers:**
```
Authorization: Bearer <token>
Role: admin
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalQueuesToday": 250,
    "activeQueues": 15,
    "completedQueues": 220,
    "averageWaitTime": 18,
    "services": [
      {
        "serviceId": 1,
        "serviceName": "Registrar",
        "queuesToday": 100,
        "averageWaitTime": 20
      }
    ]
  }
}
```

---

### Get Analytics
```
GET /api/admin/analytics
```

**Headers:**
```
Authorization: Bearer <token>
Role: admin
```

**Query Parameters:**
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `serviceId` (optional): Filter by service

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalQueues": 5000,
    "averageWaitTime": 18.5,
    "averageServiceTime": 8.2,
    "peakHours": [
      {
        "hour": 9,
        "queueCount": 450
      }
    ],
    "serviceStatistics": [
      {
        "serviceId": 1,
        "serviceName": "Registrar",
        "totalQueues": 2000,
        "averageWaitTime": 20,
        "completionRate": 95
      }
    ]
  }
}
```

---

## WebSocket Events

### Client → Server

#### Join Service Room
```javascript
socket.emit('join', { room: 'service:1' })
```

#### Join User Room (for notifications)
```javascript
socket.emit('join', { room: 'user:123' })
```

#### Leave Room
```javascript
socket.emit('leave', { room: 'service:1' })
```

---

### Server → Client

#### Queue Update
```javascript
socket.on('queue_update', (data) => {
  // data: {
  //   serviceId: 1,
  //   currentServing: "REG-045",
  //   waitingCount: 12,
  //   estimatedWait: 20
  // }
})
```

#### Queue Called
```javascript
socket.on('queue_called', (data) => {
  // data: {
  //   queueId: 123,
  //   queueNumber: "REG-046",
  //   counterNumber: "1",
  //   counterLocation: "Counter 1"
  // }
})
```

#### Counter Status Change
```javascript
socket.on('counter_status_change', (data) => {
  // data: {
  //   counterId: 1,
  //   status: "open" | "busy" | "closed" | "break"
  // }
})
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional details
  }
}
```

### Common Error Codes

- `AUTH_REQUIRED` (401): Authentication required
- `AUTH_INVALID` (401): Invalid credentials
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Validation failed
- `SERVER_ERROR` (500): Internal server error
- `QUEUE_FULL` (400): Queue is full
- `QUEUE_ALREADY_EXISTS` (400): User already has active queue

---

## Rate Limiting

API requests are rate-limited:
- **Authentication endpoints**: 5 requests per minute
- **Queue endpoints**: 20 requests per minute
- **Other endpoints**: 100 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

