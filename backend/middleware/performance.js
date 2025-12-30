/**
 * Performance Monitoring Middleware
 * Tracks API response times and logs slow requests
 */

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  // Override res.json to track response time
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB

    // Log slow requests (over 500ms)
    if (responseTime > 500) {
      console.warn(`⚠️  Slow Request: ${req.method} ${req.path} - ${responseTime}ms`);
    }

    // Log very slow requests (over 1s)
    if (responseTime > 1000) {
      console.error(`🐌 Very Slow Request: ${req.method} ${req.path} - ${responseTime}ms`);
    }

    // Add performance header in development
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Memory-Used', `${memoryUsed.toFixed(2)}MB`);
    }

    return originalJson(data);
  };

  next();
};

module.exports = performanceMonitor;

