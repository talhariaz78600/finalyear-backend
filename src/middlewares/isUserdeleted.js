const User = require('../models/users/User');
const AppError = require('../utils/appError');

const isUserDeleted = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  if (user.isDeleted) {
    return next(new AppError('User account is deleted', 403));
  }
  return next();
};

module.exports = isUserDeleted;
