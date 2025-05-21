const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/users/User');

module.exports = catchAsync(async (req, res, next) => {
 

  const { authorization } = req.headers;


  if (!authorization) {
    return res.status(401).send({ error: "You must be logged in" });
  }
  const token = authorization.split(" ")[1];
  // console.log("token\n", token);

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded?.user?._id)
    .select('+password')
    .populate('subscription').populate('templateId');
  if (!currentUser) {
    return next(
      new AppError('The user associated with this token doesnot exist.', 401, {
        user: 'user doesnot exists'
      })
    );
  }
  


  if(currentUser && currentUser?.status==="Delete"){
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }
  if (!req.originalUrl.includes('logout') && currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401, {
        user: 'User recently changed password. Please log in again'
      })
    );
  }
  if (currentUser.isDeactivated) {
    return next(
      new AppError('User deleted.', 401, {
        user: 'Contact admin for account reactivation!'
      })
    );
  }
  req.user = currentUser;
  return next();
});
