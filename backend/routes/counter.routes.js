const express = require('express');
const router = express.Router();
const counterController = require('../controllers/counterController');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/counters
 * @desc    Get all counters
 * @access  Private (Admin/Counter Staff)
 */
router.get('/', authenticateToken, authorize('admin', 'counter_staff'), counterController.getAllCounters);

/**
 * @route   GET /api/counters/my-counters
 * @desc    Get counters assigned to current staff member
 * @access  Private (Counter Staff)
 */
router.get('/my-counters', authenticateToken, authorize('counter_staff', 'admin'), counterController.getMyCounters);

/**
 * @route   GET /api/counters/:id
 * @desc    Get counter by ID
 * @access  Private (Counter Staff/Admin)
 */
router.get('/:id', authenticateToken, authorize('counter_staff', 'admin'), counterController.getCounterById);

/**
 * @route   POST /api/counters/:counterId/call-next
 * @desc    Call next queue number
 * @access  Private (Counter Staff)
 */
router.post('/:counterId/call-next', authenticateToken, authorize('counter_staff', 'admin'), counterController.callNext);

/**
 * @route   POST /api/counters/:counterId/start-serving/:queueId
 * @desc    Start serving a queue
 * @access  Private (Counter Staff)
 */
router.post('/:counterId/start-serving/:queueId', authenticateToken, authorize('counter_staff', 'admin'), counterController.startServing);

/**
 * @route   POST /api/counters/:counterId/complete/:queueId
 * @desc    Complete queue service
 * @access  Private (Counter Staff)
 */
router.post('/:counterId/complete/:queueId', authenticateToken, authorize('counter_staff', 'admin'), counterController.completeService);

/**
 * @route   POST /api/counters/:counterId/status
 * @desc    Update counter status
 * @access  Private (Counter Staff)
 */
router.post('/:counterId/status', authenticateToken, authorize('counter_staff', 'admin'), counterController.updateCounterStatus);

/**
 * @route   GET /api/counters/:counterId/stats
 * @desc    Get counter statistics
 * @access  Private (Counter Staff)
 */
router.get('/:counterId/stats', authenticateToken, authorize('counter_staff', 'admin'), counterController.getCounterStats);

module.exports = router;

