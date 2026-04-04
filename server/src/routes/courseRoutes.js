const express = require('express');
const {
  getAllSubjects,
  getSubjectBySlug,
  createSubject,
  updateSubject,
  deleteSubject,
  getCoursesBySubject,
  getCourseByCode,
  searchNptelCourses,
  getNptelCoursePreview,
  importNptelCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const { protectRoute, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Subject Routes
router.get('/subjects', getAllSubjects);
router.get('/subjects/:slug', getSubjectBySlug);
router.post('/subjects', protectRoute, authorize('admin'), createSubject);
router.put('/subjects/:id', protectRoute, authorize('admin'), updateSubject);
router.delete('/subjects/:id', protectRoute, authorize('admin'), deleteSubject);

// Course Routes (aliases for cleaner client paths)
router.get('/discover/search', searchNptelCourses);
router.get('/discover/course/:catalogId', getNptelCoursePreview);
router.get('/courses/subject/:subjectId', getCoursesBySubject);
router.get('/courses/code/:code', getCourseByCode);
router.post('/courses/import-nptel', optionalAuth, importNptelCourse);

// Clean aliases without the double "/courses" segment
router.get('/search', searchNptelCourses);
router.get('/course-preview/:catalogId', getNptelCoursePreview);
router.get('/subject/:subjectId', getCoursesBySubject);
router.get('/code/:code', getCourseByCode);
router.post('/import-nptel', optionalAuth, importNptelCourse);
router.post('/courses', protectRoute, authorize('admin'), createCourse);
router.put('/courses/:id', protectRoute, authorize('admin'), updateCourse);
router.delete('/courses/:id', protectRoute, authorize('admin'), deleteCourse);

module.exports = router;
