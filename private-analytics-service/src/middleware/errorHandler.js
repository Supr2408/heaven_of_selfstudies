class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

const errorHandler = (error, req, res, next) => {
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = {
  AppError,
  errorHandler,
};
