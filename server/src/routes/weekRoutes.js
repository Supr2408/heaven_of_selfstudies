const express = require('express');
const {
  getAllYearInstances,
  getYearInstances,
  getYearInstance,
  createYearInstance,
  updateYearInstance,
  getWeeks,
  getWeek,
  createWeek,
  updateWeek,
  getWeekStats,
  addMaterialToWeek,
  removeMaterialFromWeek,
  updateMaterialsFromNptel,
  getWeekMaterials,
} = require('../controllers/yearInstanceController');
const { protectRoute, authorize } = require('../middleware/auth');

const router = express.Router();

// Year Instance Routes
router.get('/year-instances', getAllYearInstances);
router.get('/year-instances/course/:courseId', getYearInstances);
router.get('/year-instance/:id', getYearInstance);
router.post('/year-instances', protectRoute, authorize('admin'), createYearInstance);
router.put('/year-instances/:id', protectRoute, authorize('admin'), updateYearInstance);

// Week Routes
router.get('/weeks/:yearInstanceId', getWeeks);
router.get('/week/:id', getWeek);
router.post('/weeks', protectRoute, authorize('admin'), createWeek);
router.put('/weeks/:id', protectRoute, authorize('admin'), updateWeek);
router.get('/week/:weekId/stats', getWeekStats);

// Material Routes
router.get('/week/:weekId/materials', getWeekMaterials);
router.post('/week/:weekId/materials', protectRoute, authorize('admin'), addMaterialToWeek);
router.delete('/week/:weekId/materials/:materialIndex', protectRoute, authorize('admin'), removeMaterialFromWeek);
router.post('/week/:weekId/materials/nptel-sync', protectRoute, authorize('admin'), updateMaterialsFromNptel);

module.exports = router;
