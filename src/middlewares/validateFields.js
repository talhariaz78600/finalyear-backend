const AppError = require('../utils/appError');

function validateRequiredFields(requiredFields) {
  return function (req, res, next) {
    const missingFields = [];

    requiredFields.forEach((field) => {
      if (!(field in req.body)) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return next(
        new AppError(`The following fields are required: ${missingFields.join(', ')}`, 400)
      );
    }

    return next();
  };
}

module.exports = validateRequiredFields;
