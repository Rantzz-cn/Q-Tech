const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/dashboard', authenticateToken, authorize('admin'), adminController.getDashboard);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get analytics data
 * @access  Private (Admin only)
 */
router.get('/analytics', authenticateToken, authorize('admin'), adminController.getAnalytics);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get('/users', authenticateToken, authorize('admin'), adminController.getAllUsers);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put('/users/:id', authenticateToken, authorize('admin'), adminController.updateUser);

/**
 * @route   GET /api/admin/services
 * @desc    Get all services (includes inactive)
 * @access  Private (Admin only)
 */
router.get('/services', authenticateToken, authorize('admin'), adminController.getAllServices);

/**
 * @route   POST /api/admin/services
 * @desc    Create a new service
 * @access  Private (Admin only)
 */
router.post('/services', authenticateToken, authorize('admin'), adminController.createService);

/**
 * @route   PUT /api/admin/services/:id
 * @desc    Update a service
 * @access  Private (Admin only)
 */
router.put('/services/:id', authenticateToken, authorize('admin'), adminController.updateService);

/**
 * @route   DELETE /api/admin/services/:id
 * @desc    Delete (deactivate) a service
 * @access  Private (Admin only)
 */
router.delete('/services/:id', authenticateToken, authorize('admin'), adminController.deleteService);

/**
 * @route   GET /api/admin/counters
 * @desc    Get all counters (includes inactive)
 * @access  Private (Admin only)
 */
router.get('/counters', authenticateToken, authorize('admin'), adminController.getAllCounters);

/**
 * @route   POST /api/admin/counters
 * @desc    Create a new counter
 * @access  Private (Admin only)
 */
router.post('/counters', authenticateToken, authorize('admin'), adminController.createCounter);

/**
 * @route   PUT /api/admin/counters/:id
 * @desc    Update a counter
 * @access  Private (Admin only)
 */
router.put('/counters/:id', authenticateToken, authorize('admin'), adminController.updateCounter);

/**
 * @route   DELETE /api/admin/counters/:id
 * @desc    Delete (deactivate) a counter
 * @access  Private (Admin only)
 */
router.delete('/counters/:id', authenticateToken, authorize('admin'), adminController.deleteCounter);

/**
 * @route   POST /api/admin/counters/:id/assign-staff
 * @desc    Assign counter to staff members
 * @access  Private (Admin only)
 */
router.post('/counters/:id/assign-staff', authenticateToken, authorize('admin'), adminController.assignCounterToStaff);

/**
 * @route   GET /api/admin/counters/:id/staff
 * @desc    Get counter staff assignments
 * @access  Private (Admin only)
 */
router.get('/counters/:id/staff', authenticateToken, authorize('admin'), adminController.getCounterStaff);

/**
 * @route   GET /api/admin/queues
 * @desc    Get all queues with filters
 * @access  Private (Admin only)
 */
router.get('/queues', authenticateToken, authorize('admin'), adminController.getAllQueues);

/**
 * @route   GET /api/admin/display-board
 * @desc    Get display board data for TV projection
 * @access  Public (or can be protected with a special token)
 */
router.get('/display-board', adminController.getDisplayBoard);

/**
 * @route   GET /api/admin/settings
 * @desc    Get system settings
 * @access  Private (Admin only)
 */
router.get('/settings', authenticateToken, authorize('admin'), adminController.getSystemSettings);

/**
 * @route   PUT /api/admin/settings
 * @desc    Update system settings
 * @access  Private (Admin only)
 */
router.put('/settings', authenticateToken, authorize('admin'), adminController.updateSystemSettings);

/**
 * @route   POST /api/admin/migrate
 * @desc    Run database migrations (requires MIGRATION_SECRET)
 * @access  Protected by secret token
 */
router.post('/migrate', adminController.runMigrations);

/**
 * @route   POST /api/admin/seed
 * @desc    Seed demo data (requires MIGRATION_SECRET)
 * @access  Protected by secret token
 */
router.post('/seed', adminController.seedDemoData);

module.exports = router;

