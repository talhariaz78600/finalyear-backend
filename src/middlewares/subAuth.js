const User = require('../models/users/User');
const AppError = require('../utils/appError');

module.exports = (req, res, next) => {
  console.log('SubAuth Middleware',req.user);

  if (req.user?.adminRole === 'subAdmin') {
    User.findOne({ adminRole: 'admin' })
      .then((superAdmin) => {
        if (!superAdmin) {
          return next(new AppError('No super admin found', 404));
        }
        req.user = superAdmin;
        next();
      })
      .catch((err) => next(new AppError(err.message, 500)));
  } else {
    next();
  }
};

