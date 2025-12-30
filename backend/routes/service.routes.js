const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

/**
 * @route   GET /api/services
 * @desc    Get all active services
 * @access  Public
 */
router.get('/', serviceController.getAllServices);

/**
 * @route   GET /api/services/:id
 * @desc    Get service by ID with counters
 * @access  Public
 */
router.get('/:id', serviceController.getServiceById);

/**
 * @route   GET /api/services/:id/queue-status
 * @desc    Get service queue status
 * @access  Public
 */
router.get('/:id/queue-status', serviceController.getServiceQueueStatus);

module.exports = router;

