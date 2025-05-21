class AppError extends Error {
  constructor(message, statusCode, fieldErrors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.fieldErrors = fieldErrors; // Store field-specific errors
    console.log('this', this);
    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
