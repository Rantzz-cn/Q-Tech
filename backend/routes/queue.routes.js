const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   POST /api/queue/request
 * @desc    Request a queue number
 * @access  Private
 */
router.post('/request', authenticateToken, queueController.requestQueue);

/**
 * @route   GET /api/queue/status/:serviceId
 * @desc    Get service queue status
 * @access  Private
 */
router.get('/status/:serviceId', authenticateToken, queueController.getServiceQueueStatus);

/**
 * @route   GET /api/queue/history
 * @desc    Get user's queue history
 * @access  Private
 */
router.get('/history', authenticateToken, queueController.getQueueHistory);

/**
 * @route   DELETE /api/queue/:queueId/cancel
 * @desc    Cancel queue entry
 * @access  Private
 */
router.delete('/:queueId/cancel', authenticateToken, queueController.cancelQueue);

/**
 * @route   GET /api/queue/:queueId
 * @desc    Get queue status
 * @access  Private
 */
router.get('/:queueId', authenticateToken, queueController.getQueueStatus);

module.exports = router;

