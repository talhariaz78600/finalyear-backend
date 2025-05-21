const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { roles } = require('../utils/types');

const CustomerOnly = catchAsync(async (req, res, next) => {
  if (req.user.role !== roles.CUSTOMER) {
    const fieldErrors = {
      message: 'Customer Access Only'
    };
    return next(
      new AppError('You do not have permission to perform this action', 403, fieldErrors)
    );
  }
  return next();
});

const VendorOnly = catchAsync(async (req, res, next) => {
  if (req.user.role !== roles.VENDOR) {
    const fieldErrors = {
      message: 'Vendor Access Only'
    };
    return next(
      new AppError('You do not have permission to perform this action', 403, fieldErrors)
    );
  }
  return next();
});

const AdminOnly = catchAsync(async (req, res, next) => {
  if (req.user.role !== roles.ADMIN) {
    const fieldErrors = {
      message: 'Admin Access Only'
    };
    return next(
      new AppError('You do not have permission to perform this action', 403, fieldErrors)
    );
  }
  return next();
});

module.exports = { CustomerOnly, VendorOnly, AdminOnly };
