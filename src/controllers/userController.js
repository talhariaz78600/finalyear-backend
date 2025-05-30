const mongoose = require('mongoose');
const { PhoneNumberUtil, PhoneNumberFormat } = require('google-libphonenumber');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { validateUserProfile } = require('../utils/joi/userValidation');
const { validateAndFormatPhoneNumber } = require('../utils/helperFunctions');
const Email = require('../utils/email');

const phoneUtil = PhoneNumberUtil.getInstance();
const { roles } = require('../utils/types');
const Vendor = require('../models/users/Developer');
const joiError = require('../utils/joiError');

const sendEmail = async (subject, email, text, data) => {
  await new Email(email, subject).sendTextEmail(subject, text, data);
};
const sendEmailforVendor = async (template, subject, email, data) => {
  const response = await new Email(email, subject).send(template, subject, data);
  return response
};


const updateMe = catchAsync(async (req, res, next) => {
  const {
    contact,
    countryCode,
    officeContact,
    officeCountryCode,
    emergencyContact,
    emergencyCountryCode,
    ...updateData
  } = req.body;

  // Find user
  const userFound = await User.findById(req.user._id);
  if (!userFound) {
    return next(new AppError('User not found', 404));
  }

  // Validate only the fields that are present in the request body
  const { error } = validateUserProfile(req.body, { partial: true });
  if (error) {

    const formattedErrors = {};
    error.details.forEach((err) => {
      const key = err.path.join('.'); // e.g., "address.mailingZip"

      if (key.startsWith('address.')) {
        const field = key.split('.')[1]; // e.g., "mailingZip"
        if (!formattedErrors.address) formattedErrors.address = {};
        formattedErrors.address[field] = err.message;
      } else {
        formattedErrors[key] = err.message;
      }
    });
    return next(new AppError('Validation failed', 400, formattedErrors));
  }

  // Validate and normalize phone numbers if provided
  try {
    if (contact !== undefined) {
      updateData.contact = contact ? validateAndFormatPhoneNumber(
        contact,
        countryCode || userFound.countryCode || userFound.countryCode
      ) : '';
      if (countryCode !== undefined) {
        updateData.countryCode = countryCode;
      }
    }

    if (officeContact !== undefined) {
      updateData.officeContact = officeContact ? validateAndFormatPhoneNumber(
        officeContact,
        officeCountryCode || userFound?.officeCountryCode
      ) : '';
      if (officeCountryCode !== undefined) {
        updateData.officeCountryCode = officeCountryCode;
      }
    }

    if (emergencyContact !== undefined) {
      updateData.emergencyContact = emergencyContact ? validateAndFormatPhoneNumber(
        emergencyContact,
        emergencyCountryCode || userFound.emergencyCountryCode
      ) : '';
      if (emergencyCountryCode !== undefined) {
        updateData.emergencyCountryCode = emergencyCountryCode;
      }
    }
  } catch (err) {
    console.log(err)
    return next(new AppError(err.message, 400));
  }

  // Update user with only provided information
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      userFound[key] = updateData[key];
    }
  });

  // Handle address updates separately if provided
  if (updateData.address) {
    userFound.address = userFound.address || {};
    Object.keys(updateData.address).forEach(key => {
      if (updateData.address[key] !== undefined) {
        userFound.address[key] = updateData.address[key];
      }
    });
  }

  await userFound.save();
  res.locals.dataId = userFound._id;

  return res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: userFound
  });
});
const CreateVendorByAdmin = catchAsync(async (req, res, next) => {
  const {

    officeContact,
    officeCountryCode,
    emergencyContact,
    emergencyCountryCode,
    ...updateData
  } = req.body;

  // Validate only the fields that are present in the request body
  const { error } = validateUserProfile(req.body);
  if (error) {

    const formattedErrors = joiError(error);

    return next(new AppError('Validation failed', 400, formattedErrors));
  }

  const { email, contact, countryCode } = req.body;

  let normalizedContact;
  let regionCode;

  try {
    const countryDialCode = parseInt(countryCode.replace('+', ''), 10);
    regionCode = phoneUtil.getRegionCodeForCountryCode(countryDialCode);
    if (!regionCode) throw new Error('Invalid country code.');

    const number = phoneUtil.parseAndKeepRawInput(contact, regionCode);
    if (!phoneUtil.isValidNumber(number) || !phoneUtil.isValidNumberForRegion(number, regionCode)) {
      throw new Error('Invalid phone number for the specified country.');
    }
    normalizedContact = phoneUtil.format(number, PhoneNumberFormat.E164);
  } catch (err) {
    return next(new AppError('Validation failed', 400, { contact: err.message }));
  }

  // Check if email or contact already exists
  const existingUsers = await User.findOne({
    $or: [{ email }, { contact: normalizedContact }]
  });
  if (existingUsers) {
    if (existingUsers.email === email) {
      return next(new AppError('Email already exists!', 400, { email: 'Email already exists!' }));
    }
    if (existingUsers.contact === normalizedContact) {

      return next(new AppError('Contact already exists!', 400, { contact: 'Contact already exists!' }));
    }
  }

  // Prepare user data
  const UserData = {
    ...updateData,
    email,
    contact: normalizedContact,
    countryCode,
    role: roles.VENDOR
    // status: 'Pending',
  };

  const user = await Vendor.create(UserData);
  const resetToken = user.createPasswordResetToken();
  const origin = req.get('origin') || process.env.FRONTEND_URL;
  const resetURL = `${origin}/auth/reset-password?token=${resetToken}`;
  try {
    const response = await sendEmailforVendor('forgotEmail', 'Reset Your Password', email, {
      firstName: user.firstName,
      resetURL
    });
    res.locals.dataId = user._id;
    return res.status(200).json({
      status: 'success',
      message: 'Vendor created successfully',
      data: user
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('There was an error sending the email. Try again later!'), 500);
  }
});

const getMe = catchAsync(async (req, res, next) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: req.user._id // filter by current user
      }
    },
    {
      $lookup: {
        from: 'taxforums', // collection name in MongoDB (lowercase + plural)
        localField: '_id',
        foreignField: 'vendorId',
        as: 'taxforums'
      }
    },
    {
      $unwind: { path: '$taxforums', preserveNullAndEmptyArrays: true }
    },
    {
      $lookup: {
        from: 'kycdocuments', // collection name in MongoDB (lowercase + plural)
        localField: '_id',
        foreignField: 'userId',
        as: 'kyc'
      }
    },
    {
      $unwind: { path: '$kyc', preserveNullAndEmptyArrays: true }
    },
    {
      $lookup: {
        from: 'countries', // if you want to populate country
        localField: 'country',
        foreignField: '_id',
        as: 'country'
      }
    },
    {
      $unwind: { path: '$country', preserveNullAndEmptyArrays: true }
    },
    {
      $lookup: {
        from: 'cities',
        localField: 'city',
        foreignField: '_id',
        as: 'city'
      }
    },
    {
      $unwind: { path: '$city', preserveNullAndEmptyArrays: true }
    }
  ]);
  if (!user || user.length === 0) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }

  return res.status(200).json({
    status: 'success',
    data: user[0]
  });
});
const getVendorforService = catchAsync(async (req, res, next) => {
  const { vendorId } = req.params;
  const user = await User.findById(vendorId);
  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }

  return res.status(200).json({
    status: 'success',
    data: user
  });
});
const getUser = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new AppError('Invalid ID format', 400, { user: 'Invalid ID format' }));
  }

  const user = await User.findById(userId).populate(['city', 'country', 'templateId']);
  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }

  return res.status(200).json({
    status: 'success',
    data: user
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  console.log('get all users route. sortBy', sortBy, 'sortOrder1', sortOrder);

  const skip = (page - 1) * limit;

  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  console.log('get all users route. sort options', sortOptions);

  const users = await User.aggregate([
    { $sort: sortOptions },
    { $skip: skip },
    { $limit: parseInt(limit, 10) },
    {
      $project: {
        password: 0,
        __v: 0
      }
    }
  ]);

  const totalUsers = await User.countDocuments();

  return res.status(200).json({
    status: 'success',
    results: users.length,
    totalUsers,
    data: users
  });
});
const getAllUsersforAdmin = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    role = "customer",
    search = "",
    status
  } = req.query;

  const skip = (page - 1) * limit;
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const query = { adminRole: { $ne: "admin" } };

  if (role) query.role = role;
  if (status) query.status = status;

  const searchQuery = [];

  if (search) {
    searchQuery.push(
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { companyName: { $regex: search, $options: 'i' } },
      { contact: { $regex: search, $options: 'i' } },
      { countryCode: { $regex: search, $options: 'i' } },
      { status: { $regex: search, $options: 'i' } }
    );
  }

  const aggregationPipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'permissions',
        localField: 'templateId',
        foreignField: '_id',
        as: 'templateId'
      }
    },
    {
      $unwind: {
        path: '$templateId',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        fullName: {
          $concat: [
            { $ifNull: ['$firstName', ''] },
            ' ',
            { $ifNull: ['$lastName', ''] }
          ]
        }
      }
    },
    ...(searchQuery.length > 0 ? [{ $match: { $or: searchQuery } }] : []),
    {
      $project: {
        password: 0,
        __v: 0,
       
      }
    }
  ];

  // Clone pipeline for count before pagination stages
  const totalUsersPipeline = [...aggregationPipeline, { $count: 'totalUsers' }];

  // Pagination
  aggregationPipeline.push(
    { $sort: sortOptions },
    { $skip: skip },
    { $limit: parseInt(limit, 10) }
  );

  const [users, totalCountResult] = await Promise.all([
    User.aggregate(aggregationPipeline),
    User.aggregate(totalUsersPipeline)
  ]);

  const totalUsers = totalCountResult[0]?.totalUsers || 0;

  return res.status(200).json({
    status: 'success',
    results: users.length,
    totalUsers,
    data: users
  });
});



const updatestaus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {

    return next(new AppError('Invalid data', 404, { status: "status is required" }));
  }
  if (!id) {
    return next(new AppError('Invalid User ID', 404));
  }


  const user = await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (status === 'active') {
    sendEmail('Account Activated', user.email, "Your account has been activated successfully. Please login to your account.", {})

  }

  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }
  res.locals.dataId = user._id;
  return res.status(202).json({
    status: 'success',
    user,
    message: 'Status updated successfully'
  });


})
const deleteMe = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.user._id, { status: 'Delete' }, { new: true, runValidators: true });

  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }
  res.locals.dataId = user._id;

  return res.status(204).json({
    status: 'success',
    message: 'Account deleted successfully'
  });
});


const sendMailToUsers = catchAsync(async (req, res, next) => {
  const { selectedIds, message } = req.body;

  if (!message) {
    return next(new AppError('Invalid data', 400, { message: 'Message is required' }));
  }

  if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
    const users = await User.find({ _id: { $in: selectedIds } }, { email: 1 });

    // Assuming you have a function to send emails
    await Promise.all(
      users.map(user => sendEmail('Inform', user.email, message))
    );
    // res.locals.dataId = user._id;

    return res.status(200).json({
      status: 'success',
      message: 'Emails sent successfully'
    });

  }
  return next(new AppError('Invalid or empty selectedIds', 400, { selectedIds: 'Invalid or empty selectedIds' }));

});


const addLastViewedService = catchAsync(async (req, res, next) => {
  const user = req.user; // or wherever you're getting the user from
  const { serviceId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return next(new AppError('Invalid service ID.', 400));
  }

  // Remove if it already exists to re-add at top
  user.lastViewedServices = user.lastViewedServices.filter(
    id => id.toString() !== serviceId
  );

  // Add new at the beginning
  user.lastViewedServices.unshift(serviceId);

  // Keep only the last 4
  if (user.lastViewedServices.length > 4) {
    user.lastViewedServices = user.lastViewedServices.slice(0, 4);
  }

  await user.save();
  res.locals.dataId = user._id; // Store the ID of the updated user in res.locals
  res.status(200).json({
    status: 'success',
    data: user.lastViewedServices,
  });
});

module.exports = {
  updateMe,
  getMe,
  getUser,
  getAllUsers,
  deleteMe,
  getAllUsersforAdmin,
  updatestaus,
  sendMailToUsers,
  getVendorforService,
  CreateVendorByAdmin,
  addLastViewedService
};
