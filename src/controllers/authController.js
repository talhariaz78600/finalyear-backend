const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { PhoneNumberFormat, PhoneNumberUtil } = require('google-libphonenumber');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { removeFields } = require('../utils/helpers');
const Email = require('../utils/email');

const phoneUtil = PhoneNumberUtil.getInstance();
const { redisClient } = require('../config/redisConfig');
const Client = require('../models/users/Client');
const Admins = require('../models/users/Admin');
const Developer = require('../models/users/Developer');
const ProjectManager = require('../models/users/ProjectManager');

const { roles } = require('../utils/types');
const { registerUserSchema, userCreateSchema } = require('../utils/joi/userValidation');
const {
  emailVerifySchema,
  emailOTPVerifySchema,
  LoginSchema
} = require('../utils/joi/emailValidation');
const { sendOtpVoiceCall, sendTwilioSms } = require('../utils/sendTwilioSms');
const joiError = require('../utils/joiError');

const signToken = (user, expires = process.env.JWT_EXPIRES_IN) => jwt.sign({ user }, process.env.JWT_SECRET, {
  expiresIn: expires
});

const generateOTP = (length = 6, expiryTimeMin = 3) => {
  const otp = crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
  const expires = Date.now() + expiryTimeMin * 60 * 1000;
  const hash = crypto
    .createHmac('sha256', process.env.OTP_SECRET)
    .update(`${otp}${expires}`)
    .digest('hex');
  console.log('otp', otp, 'hashed otp', hash, 'expires', expires);
  return { otp, hash, expires };
};

const createSendToken = (user, statusCode, res) => {
  const userWithRemovedFields = removeFields(user.toJSON(), [
    'password',
    'passwordChangedAt',
    'passwordResetToken',
    'passwordResetExpires',
    'otp',
    'otpExpiration',
    'otpVerifiedAt',
    'lastLoginAt',
    'createdAt',
    'updatedAt'
  ]);
  const token = signToken(userWithRemovedFields);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: userWithRemovedFields
  });
};



const sendEmail = async (template, subject, email, data) => {
  await new Email(email, subject).send(template, subject, data);
};
const registerUser = catchAsync(async (req, res, next) => {
  const { error } = userCreateSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true
  });

  if (error) {
    const errorFields = joiError(error);
    return next(new AppError('Validation failed', 400, { errorFields }));
  }

  const { email } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return next(new AppError('Email already exists!', 400, {
      email: 'Email already exists!'
    }));
  }

  const newUser = new Admins(req.body);

  await newUser.save({ validateBeforeSave: false });
  res.locals.dataId = newUser._id;
  res.locals.actor = newUser;

  await createSendToken(newUser, 201, res);
});


const resendOtp = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const { error } = emailVerifySchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }

  const userData = await User.findOne({ email });
  if (!userData) {
    return next(new AppError('user not found', 400, { auth: 'User not found' }));
  }

  // generate otp to send it to user email
  const { otp, expires, hash } = generateOTP(6, 6); // valid for 6 minutes
  // here we will send the otp to user email in order to get the user email verified

  await sendEmail('emailVerify', 'Verify Your Email', email, {
    firstName: userData.firstName,
    otp
  });
  console.log('OTP Email Resent');

  // saving the hashed OTP in DB
  userData.OTP = hash;
  userData.otpExpiration = expires;
  await userData.save({ validateBeforeSave: false });
  res.locals.dataId = userData._id;
  res.locals.actor = userData;
  return res.status(200).json({
    status: 'success',
    message: `OTP resent to the ${email}`,
    data: { expiresIn: expires }
  });
});

const verifyotp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  const { error } = emailOTPVerifySchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }

  const userData = await User.findOne({ email });
  if (!userData) {
    return next(new AppError('user not found', 400), {
      user: 'user not found'
    });
  }


  // check for otp expiration
  if (userData?.otpExpiration < Date.now()) {
    return next(new AppError('Invalid OTP.', 400, { otp: 'Invalid or expired OTP.' }));
  }

  const newHash = crypto
    .createHmac('sha256', process.env.OTP_SECRET)
    .update(`${otp}${userData?.otpExpiration}`)
    .digest('hex');

  // const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  // Validate OTP
  console.log('newHash', newHash);
  console.log('userData?.otp', userData?.OTP);
  if (userData?.OTP !== newHash) {
    return next(new AppError('Invalid OTP.', 400, { otp: 'Invalid or expired OTP.' }));
  }


  userData.emailVerified = true;
  userData.OTP = '';
  userData.otpExpiration = '';
  userData.otpVerifiedAt = Date.now();
  await userData.save({ validateBeforeSave: false });


  const userToSend = {
    _id: userData._id,
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    contact: userData.contact,
    countryCode: userData.countryCode,
    countryName: userData.countryName,
    role: userData.role,
    emailVerified: userData.emailVerified,
    subscription: userData.subscription,
    provider: userData.provider,
    profileCompleted: userData.profileCompleted,
    isVerified: userData.isVerified,
    fullName: userData.fullName
  };

  const token = signToken(userToSend);
  res.locals.dataId = userData._id;
  res.locals.actor = userData;

  return res.status(200).json({
    status: 'success',
    token,
    data: userToSend
  });

});

const verifyPhoneotp = catchAsync(async (req, res, next) => {
  const { contact, otp } = req.body;

  if (!contact || !otp) {
    const fieldErrors = {
      contact: contact ? undefined : 'Contact number is required.',
      otp: otp ? undefined : 'OTP is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  const userData = await User.findOne({ contact });
  if (!userData) {
    return next(new AppError('user not found', 400, { user: 'user not found' }));
  }


  // check for otp expiration
  if (userData?.otpExpiration < Date.now()) {
    return next(new AppError('Invalid OTP.', 400, { otp: 'Invalid or expired OTP.' }));
  }

  const newHash = crypto
    .createHmac('sha256', process.env.OTP_SECRET)
    .update(`${otp}${userData?.otpExpiration}`)
    .digest('hex');

  // Validate OTP
  console.log('newHash Phone', newHash);
  console.log('userData?.otp Phone', userData?.OTP);
  if (userData?.OTP !== newHash) {
    return next(new AppError('Invalid OTP.', 400, { otp: 'Invalid or expired OTP.' }));
  }


  userData.contactVerified = true;
  userData.OTP = '';
  userData.otpExpiration = '';
  userData.otpVerifiedAt = Date.now();
  await userData.save({ validateBeforeSave: false });


  const userToSend = {
    _id: userData._id,
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    contact: userData.contact,
    countryCode: userData.countryCode,
    countryName: userData.countryName,
    role: userData.role,
    emailVerified: userData.emailVerified,
    contactVerified: userData.contactVerified,
    subscription: userData.subscription,
    provider: userData.provider,
    profileCompleted: userData.profileCompleted,
    isVerified: userData.isVerified,
    fullName: userData.fullName
  };

  const token = signToken(userToSend);
  res.locals.dataId = userData._id;
  res.locals.actor = userData;
  return res.status(200).json({
    status: 'success',
    token,
    data: userToSend
  });

});

const sendEmailVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const { error } = emailVerifySchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }

  // if (!email) {
  //   const fieldErrors = {
  //     email: email ? undefined : "Email is required.",
  //   };
  //   return next(new AppError("Validation failed", 400, fieldErrors));
  // }

  const userData = await User.findOne({ email });
  if (!userData) {
    return next(new AppError('user not found', 400, { user: 'user not found' }));
  }

  // generate otp to send it to user email
  const { otp, expires, hash } = generateOTP(6, 6); // valid for 6 minutes
  // here we will send the otp to user email in order to get the user email verified

  await sendEmail('emailVerify', 'Verify Your Email', email, {
    firstName: userData.firstName,
    otp
  });
  console.log('OTP Email sent');

  // saving the hashed OTP in DB
  userData.OTP = hash;
  userData.otpExpiration = expires;
  await userData.save({ validateBeforeSave: false });
  res.locals.dataId = userData._id;
  res.locals.actor = userData;

  return res.status(200).json({
    status: 'success',
    message: `OTP sent to the ${email}`,
    data: { expiresIn: expires }
  });
});


const sendPhoneVerification = catchAsync(async (req, res, next) => {
  const { contact } = req.body;

  if (!contact) {
    return next(
      new AppError('Validation failed', 400, {
        contact: 'Contact number is required.'
      })
    );
  }
  // we will find the user with that contact that he used to register
  const userData = await User.findOne({ contact });
  if (!userData) {
    return next(new AppError('user not found', 400, { user: 'user not found' }));
  }

  // generate otp to send it to user phone number
  const { otp, expires, hash } = generateOTP(6, 6); // valid for 6 minutes

  // here we will send the otp to user phone
  await sendTwilioSms(
    contact,
    otp
  );

  console.log('OTP on Contact sent');

  // saving the hashed OTP in DB
  userData.OTP = hash;
  userData.otpExpiration = expires;
  await userData.save({ validateBeforeSave: false });
  res.locals.dataId = userData._id;
  res.locals.actor = userData;
  return res.status(200).json({
    status: 'success',
    message: `OTP sent to the ${contact}`,
    data: { expiresIn: expires }
  });
});

const resendOtpNumber = catchAsync(async (req, res, next) => {
  const { contact } = req.body;

  if (!contact) {
    return next(
      new AppError('Validation failed', 400, {
        contact: 'Contact number is required.'
      })
    );
  }
  // we will find the user with THAT CONTACT that he used to register
  const userData = await User.findOne({ contact });
  if (!userData) {
    return next(new AppError('user not found', 400, { user: 'user not found' }));
  }

  // generate otp to send it to user phone number
  const { otp, expires, hash } = generateOTP(6, 6); // valid for 6 minutes

  // here we will send the otp to user phone
  await sendTwilioSms(
    contact,
    otp
  );

  console.log('OTP on Contact Resent');

  // saving the hashed OTP in DB
  userData.OTP = hash;
  userData.otpExpiration = expires;
  await userData.save({ validateBeforeSave: false });

  res.locals.dataId = userData._id;
  res.locals.actor = userData;
  return res.status(200).json({
    status: 'success',
    message: `OTP Resent to the ${contact}`,
    data: { expiresIn: expires }
  });
});

const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const { error } = LoginSchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }


  const user = await User.findOne({ email }).populate({ path: 'templateId' }).select('+password');


  if (!user) {
    const fieldErrors = {
      password: 'Invalid Credentials'
    };
    return next(new AppError('Invalid credentials', 401, fieldErrors));
  }

  if (user?.status === "Pending") {
    return next(new AppError('This account is under review by Admin. Please contact with Admin', 404));
  } if (user?.status === "Rejected") {
    return next(new AppError('This account is rejected by Admin. Please contact with Admin', 404));
  }
  if (user && user?.status === "Delete") {
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }


  if (user && (user?.status === "Suspend" || user?.status === "Inactive")) {
    return next(new AppError('This account Suspend by Admin. Please contact with Admin', 401));
  }

  if (!user.password) {
    const fieldErrors = {
      password: 'This account uses social login. Please login using Google/Facebook'
    };
    return next(
      new AppError(
        'This account uses social login. Please login using Google/Facebook',
        401,
        fieldErrors
      )
    );
  }

  // validate the password
  if (user) {
    const isPasswordCorrect = await user.comparePasswords(password, user.password);
    if (!isPasswordCorrect) {
      const fieldErrors = {
        password: 'Invalid Credentials'
      };
      return next(new AppError('Invalid credentials', 401, fieldErrors));
    }
  }

  // look if a user has email verified
  // if (!user.emailVerified) {
  //   return next(
  //     new AppError('Email Not Verified', 401, {
  //       email: 'Email not verified',
  //       redirect: true
  //     })
  //   );
  // }

  user.lastLoginAt = Date.now();

  // Remove sensitive fields but keep the original Mongoose document
  const userData = removeFields(user.toObject(), [
    'password',
    'passwordChangedAt',
    'OTP',
    'otpExpiration',
    'otpVerifiedAt',
    'passwordResetToken',
    'passwordResetExpires',
    'lastLoginAt',
    'createdAt',
    'updatedAt'
  ]);

  // Save the original Mongoose document (if needed)
  await user.save({ validateBeforeSave: false });

  // Generate token
  const token = signToken(userData);

  // console.log('token', token);
  res.locals.dataId = user._id;
  res.locals.actor = user;
  return res.status(200).json({
    status: 'success',
    token,
    data: userData
  });
});


const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Validate email
  const { error } = emailVerifySchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});
    return next(new AppError('Validation failed', 400, { errorFields }));
  }
  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }

  if (user && user?.status === "Delete") {
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }


  if (user && user?.status === "Suspend" || user?.status === "Inactive") {
    return next(new AppError('This account Suspend by Admin. Please contact with Admin', 401));
  }

  // const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
  //   expiresIn: "6m",
  // });

  // console.log("\nresetToken:", resetToken);

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Optionally store in Redis if needed
  // await redisClient.setEx(`resetPassword:${user._id}`, 10 * 60, resetToken);

  // Generate reset URL with token
  const origin = req.get('origin') || process.env.FRONTEND_URL;

  // Ensure correct reset URL based on request origin
  const resetURL = `${origin}/reset-password?token=${resetToken}`;

  // const resetURL = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

  console.log('Reset URL:', resetURL);

  // Send password reset email
  try {
    await sendEmail('forgotEmail', 'Reset Your Password', email, {
      firstName: user.firstName,
      resetURL
    });

    // // save the passwordResetToken and passwordResetExpires in DB
    // user.passwordResetToken = resetToken;
    // // user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    // await user.save({ validateBeforeSave: false });
    res.locals.dataId = user._id;
    res.locals.actor = user;

    return res.status(200).json({
      status: 'success',
      message: 'Password reset link sent successfully!'
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error sending the email. Try again later!'), 500);
  }
});

const verifyForgetOtp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    const fieldErrors = {
      email: email ? undefined : 'Email is required.',
      otp: otp ? undefined : 'OTP is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  // Retrieve temporary password reset data from Redis
  const tempData = await redisClient.get(`forgotPassword:${email}`);
  if (!tempData) {
    const fieldErrors = {
      otp: 'OTP expired or invalid. Please request again.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  const { passwordResetToken, passwordResetExpires } = JSON.parse(tempData);

  // Hash the provided OTP and compare with the stored token
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  if (hashedOTP !== passwordResetToken || Date.now() > passwordResetExpires) {
    const fieldErrors = { otp: 'Invalid or expired OTP.' };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  // Find the user in the database
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found.' }));
  }

  // Generate a short-lived JWT token for password reset
  const token = signToken(user, '3m');

  user.otpVerifiedAt = Date.now();
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  // Save the updated user document
  await user.save({ validateBeforeSave: false });

  // Clear OTP data from Redis as it’s no longer needed
  await redisClient.del(`forgotPassword:${email}`);
  res.locals.dataId = user._id;
  res.locals.actor = user;

  return res.status(200).json({
    status: 'success',
    token,
    data: { email: user.email },
    message: 'OTP Verified successfully!'
  });
});

const resetPassword = catchAsync(async (req, res, next) => {
  const { password, token } = req.body;
  // let decoded;

  if (!password || !token) {
    const fieldErrors = {
      password: password ? undefined : 'Password is required.',
      token: token ? undefined : 'Token is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }



  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  }).select('+password');

  if (!user) {
    return next(new AppError('Invalid request.', 404, { user: 'user not found' }));
  }

  if (user && user?.status === "Delete") {
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }


  if (user && user?.status === "Suspend" || user?.status === "Inactive") {
    return next(new AppError('This account Suspend by Admin. Please contact with Admin', 401));
  }
  if (await user.comparePasswords(password, user.password)) {
    const fieldErrors = {
      password: 'Your new password must be different from the current one.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save({ validateBeforeSave: false });
  res.locals.dataId = user._id;
  res.locals.actor = user;
  return createSendToken(user, 200, res);
});

const updatePassword = catchAsync(async (req, res, next) => {
  const { password, oldPassword } = req.body;
  const { user } = req;
  if (!password || !oldPassword) {
    const fieldErrors = {
      password: password ? undefined : 'Password is required.',
      oldPassword: oldPassword ? undefined : 'Old Password is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  if (!user) {
    return next(new AppError('user not found', 404, { user: 'user not found' }));
  }

  // check if the old password is equal to stored password(correct old password)
  if (!(await user.comparePasswords(oldPassword, user.password))) {
    const fieldErrors = {
      password: 'Provided old password is incorrect'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }
  // new password must not be equal to old password
  if (await user.comparePasswords(password, user.password)) {
    const fieldErrors = {
      password: 'Your new password must be different from the current one.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  user.passwordResetToken = undefined;

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: { email: user.email },
    message: 'Password updated Successfully'
  });
});

const createFirstPassword = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    const fieldErrors = {
      password: password ? undefined : 'Password is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  const user = await User.findOne({
    _id: req?.user?._id
  }).select('+password');

  if (!user) {
    return next(new AppError('user not found', 404, { user: 'user not found' }));
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  if (!user.providers.includes('local')) {
    user.providers.push('local');
  }
  res.locals.dataId = user._id;
  res.locals.actor = req.user;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: { email: user.email },
    message: 'Password created Successfully'
  });
});





module.exports = {
  registerUser,
  loginUser,

  verifyotp,
  verifyPhoneotp,
  sendEmailVerification,
  sendPhoneVerification,
  forgotPassword,
  verifyForgetOtp,
  resetPassword,
  createFirstPassword,

  resendOtp,
  resendOtpNumber,
  sendEmail,
  updatePassword,
  generateOTP
};
