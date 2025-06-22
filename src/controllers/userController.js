const mongoose = require('mongoose');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const joiError = require('../utils/joiError');
const { userCreateSchema, userUpdateSchema } = require('../utils/joi/userValidation');
const { roles } = require('../utils/types');
const Email = require('../utils/email');
const Project = require('../models/Project');

const sendEmail = async (subject, email, text, data) => {
  await new Email(email, subject).sendTextEmail(subject, text, data);
};

// Create User (Admin only: client, developer, manager, subadmin)
const createUser = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!Object.values(roles).includes(role)) {
    return next(new AppError(`Role must be one of: ${Object.values(roles).join(', ')}`, 400));
  }

  const { error } = userCreateSchema.validate(req.body, {
    abortEarly: false, // Collect all errors
    allowUnknown: true // Allow additional fields not in schema
  });

  if (error) {
    const fieldErrors = joiError(error);
    return next(new AppError("Invalid user data", 400, { fieldErrors }));
  }

  const existing = await User.findOne({ email: req.body.email });
  if (existing) return next(new AppError('Email already registered.', 400));

  const user = await User.create(req.body);
  return res.status(201).json({ status: 'success', data: user });
});

// Get single user (all roles)
const getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findById(id).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  return res.status(200).json({ status: 'success', data: user });
});
const getMe = catchAsync(async (req, res, next) => {
  const { id } = req.user;


  const user = await User.findById(id).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  return res.status(200).json({ status: 'success', data: user });
});

// List users with filters (role, search, pagination)
const getUsers = catchAsync(async (req, res, next) => {
  const { role, search = '', page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;
  const match = {};

  if (role && Object.values(roles).includes(role)) match.role = role;
  if (status) match.status = status;
  if (search) match.$or = [
    { firstName: { $regex: search, $options: 'i' } },
    { lastName: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];

  const [total, users] = await Promise.all([
    User.countDocuments(match),
    User.find(match)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .select('-password')
  ]);

  res.status(200).json({
    status: 'success',
    total,
    results: users.length,
    data: users
  });
});

// Update user (all roles)
const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { error } = userUpdateSchema.validate(req.body);
  if (error) return next(new AppError(joiError(error), 400));

  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({ status: 'success', data: user });
});
// Update  (all roles)
const updateMe = catchAsync(async (req, res, next) => {
  const id = req.user.id;
  console.log('Updating user:', req.body);
  const { error } = userUpdateSchema.validate(req.body, {
    abortEarly: false, // Collect all errors
    allowUnknown: true // Allow additional fields not in schema
  });
  if (error) {
    return next(new AppError("Invalid user data", 400, { fieldErrors: joiError(error) }));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({ status: 'success', data: user });
});

// Delete (soft)
const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndDelete(id);
  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({ status: 'success', data: null });
});

// Update status (active/inactive/suspend)
const updateStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return next(new AppError('Status is required', 400));

  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!user) return next(new AppError('User not found', 404));

  if (status === 'Active') {
    try {
      await sendEmail('Account Activated', user.email, `Hi ${user.firstName}, your account is active now.`);
    } catch (err) { console.error('Email error:', err); }
  }

  res.status(200).json({ status: 'success', data: user });
});

// Admin Dashboard stats (aggregation)
const getDashboardStats = catchAsync(async (req, res) => {
  // User stats by role
  const userStats = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $project: { role: '$_id', count: 1, _id: 0 } }
  ]);

  // Project stats by status
  const projectStats = await Project.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } }
  ]);

  // Last 4 projects (most recent)
  const lastProjects = await Project.aggregate([
       {
      $lookup: {
        from: 'users',
        localField: 'clientId',
        foreignField: '_id',
        as: 'clientId'
      }
    },
    { $unwind: { path: '$clientId', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'managerId',
        foreignField: '_id',
        as: 'managerId'
      }
    },
    { $unwind: { path: '$managerId', preserveNullAndEmptyArrays: true } },
        {
      $lookup: {
        from: 'tasks',
        localField: '_id',
        foreignField: 'projectId',
        as: 'tasks'
      }
    },
    {
      $addFields: {
        totalTasks: { $size: '$tasks' },
        completedTasks: {
          $size: {
            $filter: {
              input: '$tasks',
              as: 'task',
              cond: { $eq: ['$$task.status', 'Completed'] }
            }
          }
        },

      }
    },
    {
      $addFields: {
        progress: {
          $cond: [
            { $eq: ['$totalTasks', 0] },
            0,
            { $multiply: [
                { $divide: ['$completedTasks', '$totalTasks'] },
                100
              ]
            }
          ]
        }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 4 },
    { $project: { __v: 0, tasks: 0 } }
  ]);


  res.status(200).json({
    status: 'success',
    data: {
      userStats,
      projectStats,
      lastProjects
    }
  });
});

const getUsersName = catchAsync(async (req, res) => {
  const { role = 'client' } = req.query;
  const match = {};
  if (role && Object.values(roles).includes(role)) match.role = role;

  const users = await User.find(match).select('firstName lastName');
  res.status(200).json({ status: 'success', data: users });
});

module.exports = { getMe, getUser, getUsers, updateUser, deleteUser, updateStatus, getDashboardStats, createUser, getUsersName, updateMe };