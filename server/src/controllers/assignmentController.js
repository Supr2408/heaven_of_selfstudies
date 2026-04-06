const Assignment = require('../models/Assignment');
const { scrapeNPTELAnnouncements } = require('../utils/nptelScraper');

/**
 * Extract and store assignments from NPTEL announcements
 * POST /api/assignments/extract
 */
const extractNPTELAssignments = async (req, res) => {
  try {
    const { courseCode } = req.body;

    if (!courseCode || typeof courseCode !== 'string') {
      return res.status(400).json({
        error: 'Valid courseCode is required',
        example: 'noc26_cs58',
      });
    }

    // Validate course code format
    if (!/^noc\d{2}_[a-z]{2,}\d+$/i.test(courseCode.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid course code format',
        format: 'noc{YY}_{subject}{code}',
        example: 'noc26_cs58 (Data Mining, Feb-Apr 2026)',
      });
    }

    console.log(`📥 Extracting assignments for course: ${courseCode}`);

    // Scrape NPTEL announcements
    const scrapedData = await scrapeNPTELAnnouncements(courseCode);

    if (!scrapedData.success) {
      return res.status(400).json({
        error: 'Failed to scrape NPTEL',
        details: scrapedData.details,
      });
    }

    // Check if assignment already exists
    let assignment = await Assignment.findOne({ courseCode });

    if (assignment) {
      console.log(
        '🔄 Updating existing assignment record for course: ' + courseCode
      );
      assignment.solutions = scrapedData.solutions;
      assignment.lastUpdated = new Date();
    } else {
      console.log('✨ Creating new assignment record for course: ' + courseCode);
      assignment = new Assignment({
        courseCode,
        courseName: scrapedData.courseInfo.name,
        semester: scrapedData.courseInfo.semester,
        year: scrapedData.courseInfo.year,
        solutions: scrapedData.solutions,
      });
    }

    await assignment.save();

    res.json({
      success: true,
      message: `Successfully extracted ${scrapedData.totalSolutions} assignments`,
      courseCode,
      courseName: scrapedData.courseInfo.name,
      semester: scrapedData.courseInfo.semester,
      year: scrapedData.courseInfo.year,
      totalSolutions: scrapedData.totalSolutions,
      solutions: assignment.solutions,
    });
  } catch (error) {
    console.error('Error extracting assignments:', error);
    res.status(500).json({
      error: 'Failed to extract assignments',
      details: error.message,
    });
  }
};

/**
 * Get assignments for a specific course
 * GET /api/assignments/:courseCode
 */
const getAssignments = async (req, res) => {
  try {
    const { courseCode } = req.params;

    const assignment = await Assignment.findOne({ courseCode }).lean();

    if (!assignment) {
      return res.status(404).json({
        error: 'No assignments found for this course code',
        courseCode,
      });
    }

    res.json({
      success: true,
      courseCode: assignment.courseCode,
      courseName: assignment.courseName,
      semester: assignment.semester,
      year: assignment.year,
      totalSolutions: assignment.solutions.length,
      solutions: assignment.solutions,
      lastUpdated: assignment.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      error: 'Failed to fetch assignments',
      details: error.message,
    });
  }
};

/**
 * Get all recorded assignments
 * GET /api/assignments
 */
const getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .sort({ createdAt: -1 })
      .select('courseCode courseName semester year solutions lastUpdated')
      .lean();

    res.json({
      success: true,
      totalCourses: assignments.length,
      assignments: assignments.map((a) => ({
        courseCode: a.courseCode,
        courseName: a.courseName,
        semester: a.semester,
        year: a.year,
        totalSolutions: a.solutions.length,
        lastUpdated: a.lastUpdated,
      })),
    });
  } catch (error) {
    console.error('Error fetching all assignments:', error);
    res.status(500).json({
      error: 'Failed to fetch assignments',
      details: error.message,
    });
  }
};

/**
 * Get a specific solution/assignment
 * GET /api/assignments/:courseCode/solution/:weekNumber
 */
const getSolution = async (req, res) => {
  try {
    const { courseCode, weekNumber } = req.params;

    const assignment = await Assignment.findOne({
      courseCode,
      'solutions.weekNumber': parseInt(weekNumber),
    }).lean();

    if (!assignment) {
      return res.status(404).json({
        error: 'Solution not found',
        courseCode,
        weekNumber,
      });
    }

    const solution = assignment.solutions.find(
      (s) => s.weekNumber === parseInt(weekNumber)
    );

    res.json({
      success: true,
      courseCode: assignment.courseCode,
      courseName: assignment.courseName,
      solution: {
        ...solution,
        embedLink: `https://drive.google.com/file/d/${solution.driveFileId}/preview`,
      },
    });
  } catch (error) {
    console.error('Error fetching solution:', error);
    res.status(500).json({
      error: 'Failed to fetch solution',
      details: error.message,
    });
  }
};

/**
 * Delete assignments for a course
 * DELETE /api/assignments/:courseCode
 */
const deleteAssignments = async (req, res) => {
  try {
    const { courseCode } = req.params;

    const result = await Assignment.deleteOne({ courseCode });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'No assignments found to delete',
        courseCode,
      });
    }

    res.json({
      success: true,
      message: 'Assignments deleted successfully',
      courseCode,
    });
  } catch (error) {
    console.error('Error deleting assignments:', error);
    res.status(500).json({
      error: 'Failed to delete assignments',
      details: error.message,
    });
  }
};

module.exports = {
  extractNPTELAssignments,
  getAssignments,
  getAllAssignments,
  getSolution,
  deleteAssignments,
};
