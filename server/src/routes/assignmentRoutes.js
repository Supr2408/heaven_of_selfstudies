const express = require('express');
const {
  extractNPTELAssignments,
  getAssignments,
  getAllAssignments,
  getSolution,
  deleteAssignments,
} = require('../controllers/assignmentController');

const router = express.Router();

/**
 * POST /api/assignments/extract
 * Extract assignments from NPTEL course code
 */
router.post('/extract', extractNPTELAssignments);

/**
 * GET /api/assignments
 * Get all recorded assignment courses
 */
router.get('/', getAllAssignments);

/**
 * GET /api/assignments/:courseCode
 * Get all assignments for a specific course
 */
router.get('/:courseCode', getAssignments);

/**
 * GET /api/assignments/:courseCode/solution/:weekNumber
 * Get specific solution/assignment for a week
 */
router.get('/:courseCode/solution/:weekNumber', getSolution);

/**
 * DELETE /api/assignments/:courseCode
 * Delete all assignments for a course
 */
router.delete('/:courseCode', deleteAssignments);

module.exports = router;
