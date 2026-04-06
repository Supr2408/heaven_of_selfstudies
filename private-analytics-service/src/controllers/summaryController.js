const { AppError } = require('../middleware/errorHandler');
const {
  buildDailyWorkbook,
  getAdminDailySummary,
  getAdminLiveSummary,
  getMyTodaySummary,
} = require('../services/analyticsService');

const getLearnerTodaySummary = async (req, res, next) => {
  const userId = String(req.header('x-user-id') || '').trim();
  if (!userId) {
    return next(new AppError('x-user-id header is required.', 400));
  }

  try {
    const timezoneOffsetMinutes = Number.parseInt(req.query.timezoneOffsetMinutes, 10) || 0;
    const summary = await getMyTodaySummary({ userId, timezoneOffsetMinutes });
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

const getDailySummary = async (req, res, next) => {
  try {
    const summary = await getAdminDailySummary({
      dateKey: String(req.query.dateKey || '').trim(),
    });
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

const getLiveSummary = async (req, res, next) => {
  try {
    const summary = await getAdminLiveSummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

const exportDailySummaryWorkbook = async (req, res, next) => {
  try {
    const dateKey = String(req.query.dateKey || '').trim();
    const { filename, buffer } = await buildDailyWorkbook({ dateKey });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLearnerTodaySummary,
  getDailySummary,
  getLiveSummary,
  exportDailySummaryWorkbook,
};
