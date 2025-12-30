const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { testConnection } = require('./config/database');
const socketServer = require('./socket/socketServer');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
socketServer.initialize(server);

// CORS Middleware - Allow requests from web dashboard and mobile app
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',')
  : (process.env.NODE_ENV === 'production' 
      ? ['*'] // Allow all in production for mobile app
      : ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.100.9:3000', 'http://192.168.100.9:3001']);

app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  credentials: true,
}));

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static('public')); // Serve static files (for WebSocket test page)

// Performance monitoring (in development)
if (process.env.NODE_ENV === 'development') {
  const performanceMonitor = require('./middleware/performance');
  app.use(performanceMonitor);
}

// Basic route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Q-Tech API',
    version: '1.0.0',
  });
});

// API base route
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Q-Tech API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
      },
      services: 'GET /api/services',
      queue: {
        request: 'POST /api/queue/request',
        status: 'GET /api/queue/status/:serviceId',
        myQueue: 'GET /api/queue/my-queue',
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard',
        services: 'GET /api/admin/services',
        queues: 'GET /api/admin/queues',
        displayBoard: 'GET /api/admin/display-board',
        settings: 'GET /api/admin/settings',
      },
    },
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
  });
});

// Health check route
app.get('/api/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    success: true,
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Routes
const authRoutes = require('./routes/auth.routes');
const serviceRoutes = require('./routes/service.routes');
const queueRoutes = require('./routes/queue.routes');
const counterRoutes = require('./routes/counter.routes');
const adminRoutes = require('./routes/admin.routes');

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
    },
  });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  server.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Test database connection on startup
    await testConnection();
  });
}

module.exports = app;

