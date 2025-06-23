const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// Create a new task (Manager only)
const createTask = catchAsync(async (req, res, next) => {
  const { title, description, status, priority, projectId, assignedTo, deadline } = req.body;

  // Validate project and user existence
  if (!mongoose.Types.ObjectId.isValid(projectId)) return next(new AppError('Invalid project ID', 400));
  if (!mongoose.Types.ObjectId.isValid(assignedTo)) return next(new AppError('Invalid user ID', 400));

  const project = await Project.findById(projectId);
  if (!project) return next(new AppError('Project not found', 404));

  const user = await User.findById(assignedTo);
  if (!user) return next(new AppError('Assigned user not found', 404));

  const task = await Task.create({
    title,
    description,
    status,
    priority,
    projectId,
    assignedTo,
    deadline,
  });

  res.status(201).json({ status: 'success', data: task });
});

// Get all tasks (Manager: filter by project, assignedTo, status, search, pagination)
const getTasks = catchAsync(async (req, res, next) => {
  const {  assignedTo, status, search = '', page = 1, limit = 100 } = req.query;
    const { projectId } = req.params;
  const skip = (page - 1) * limit;
  const filter = { projectId };

  if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) filter.assignedTo = assignedTo;
  if (status) filter.status = status;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const [total, tasks] = await Promise.all([
    Task.countDocuments(filter),
    Task.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
  ]);

  res.status(200).json({
    status: 'success',
    total,
    results: tasks.length,
    data: tasks
  });
});
const getDeveloperTasks = catchAsync(async (req, res, next) => {
  const {   status, search = '', page = 1, limit = 100 } = req.query;
    const id=req.user._id;
  const skip = (page - 1) * limit;
  const filter = { assignedTo: id };

  if (status) filter.status = status;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const [total, tasks] = await Promise.all([
    Task.countDocuments(filter),
    Task.find(filter)
      .populate('projectId', 'title')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
  ]);

  res.status(200).json({
    status: 'success',
    total,
    results: tasks.length,
    data: tasks
  });
});

// Get single task
const getTask = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid task ID', 400));

  const task = await Task.findById(id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('projectId', 'name');
  if (!task) return next(new AppError('Task not found', 404));

  res.status(200).json({ status: 'success', data: task });
});

// Update task (Manager only)
const updateTask = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid task ID', 400));

  const update = { ...req.body, updatedAt: new Date(), status: "Completed" };
  const task = await Task.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!task) return next(new AppError('Task not found', 404));

  res.status(200).json({ status: 'success', data: task });
});

const getDeveloperTaskStats = catchAsync(async (req, res, next) => {
  const developerId = req.user._id;

  const [total, pending, inProgress, completed, onHold] = await Promise.all([
    Task.countDocuments({ assignedTo: developerId }),
    Task.countDocuments({ assignedTo: developerId, status: 'Pending' }),
    Task.countDocuments({ assignedTo: developerId, status: 'In Progress' }),
    Task.countDocuments({ assignedTo: developerId, status: 'Completed' }),
    Task.countDocuments({ assignedTo: developerId, status: 'On Hold' }),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalTasks: total,
      pendingTasks: pending,
      inProgressTasks: inProgress,
      completedTasks: completed,
      onHoldTasks: onHold,
    }
  });
});

// Delete task (Manager only)
const   deleteTask = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid task ID', 400));

  const task = await Task.findByIdAndDelete(id);
  if (!task) return next(new AppError('Task not found', 404));

  res.status(200).json({ status: 'success', data: null });
});

module.exports = {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  getDeveloperTasks,
  getDeveloperTaskStats
};