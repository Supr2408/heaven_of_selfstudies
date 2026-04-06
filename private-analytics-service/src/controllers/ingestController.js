const { AppError } = require('../middleware/errorHandler');
const { trackStudyActivity } = require('../services/analyticsService');

const ingestStudyActivity = async (req, res, next) => {
  const requiredFields = ['eventId', 'userId', 'email', 'name', 'courseId', 'courseTitle'];
  const missingField = requiredFields.find((field) => !req.body?.[field]);

  if (missingField) {
    return next(new AppError(`${missingField} is required.`, 400));
  }

  try {
    const result = await trackStudyActivity(req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestStudyActivity,
};
