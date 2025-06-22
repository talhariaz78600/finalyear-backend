const mongoose = require('mongoose');
const Project = require('../models/Project');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const joiError = require('../utils/joiError');
const { projectSchema } = require('../utils/joi/projectValidation');
const Task = require('../models/Task');

// Create a new project
const createProject = catchAsync(async (req, res, next) => {
  // Require core project fields dynamically
  const schema = projectSchema.fork(
    ['title', 'description', 'clientId', 'managerId', 'deadline'],
    s => s.required()
  );
  const { error } = schema.validate(req.body);
  if (error) return next(new AppError(joiError(error), 400));

  const project = await Project.create(req.body);
  return res.status(201).json({
    status: 'success',
    message: 'Project created successfully',
    data: project
  });
});

// Get a single project
const getProject = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid project ID', 400));

  const project = await Project.findById(id)
    .populate('clientId', 'firstName lastName email role')
    .populate('managerId', 'firstName lastName email role')
    .populate('developers', 'firstName lastName email role')
    .populate('tasks');
  if (!project) return next(new AppError('Project not found', 404));

  return res.status(200).json({ status: 'success', data: project });
});

// List projects with pagination & filters
const getAllProjects = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, search, managerId, clientId } = req.query;
  const skip = (page - 1) * limit;
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Build match stage
  const match = {};
  if (status) match.status = status;
  if (search) match.title = { $regex: search, $options: 'i' };
  if (managerId) match.managerId = new mongoose.Types.ObjectId(managerId);
  if (clientId) match.clientId = new mongoose.Types.ObjectId(clientId);

  const pipeline = [
    { $match: match },
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
    { $sort: sortOptions },
    { $skip: Number(skip) },
    { $limit: Number(limit) }
  ];

  const countPipeline = [{ $match: match }, { $count: 'total' }];

  const [projects, totalArr] = await Promise.all([
    Project.aggregate(pipeline),
    Project.aggregate(countPipeline)
  ]);
  const totalProjects = totalArr[0]?.total || 0;

  return res.status(200).json({
    status: 'success',
    results: projects.length,
    totalProjects,
    data: projects
  });
});

// Update project
const updateProject = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid project ID', 400));
  const updatedProject = await Project.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!updatedProject) return next(new AppError('Project not found', 404));

  return res.status(200).json({
    status: 'success',
    message: 'Project updated successfully',
    data: updatedProject
  });
});

// Delete project
const deleteProject = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid project ID', 400));
  const deleted = await Project.findByIdAndDelete(id);
  if (!deleted) return next(new AppError('Project not found', 404));

  return res.status(200).json({ status: 'success', message: 'Project deleted successfully', data: null });
});

// Assign tasks to developers within a project
const assignTasks = catchAsync(async (req, res, next) => {
  const { projectId } = req.params;
  const { taskIds = [], developerIds = [] } = req.body;

  if (!mongoose.Types.ObjectId.isValid(projectId)) return next(new AppError('Invalid project ID', 400));
  const project = await Project.findById(projectId);
  if (!project) return next(new AppError('Project not found', 404));

  // Validate and update each task
  const tasks = await Task.find({ _id: { $in: taskIds } });
  for (const task of tasks) {
    if (!developerIds.includes(task.assignedTo.toString())) continue;
    task.status = 'Assigned';
    await task.save();
  }

  // Add to project
  project.tasks = Array.from(new Set([...project.tasks.map(String), ...taskIds]));
  project.developers = Array.from(new Set([...project.developers.map(String), ...developerIds]));
  await project.save();

  return res.status(200).json({
    status: 'success',
    message: 'Tasks assigned successfully',
    data: { project }
  });
});

// Get project analytics (task completion, progress)
const getProjectAnalytics = catchAsync(async (req, res, next) => {
  const { projectId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(projectId)) return next(new AppError('Invalid project ID', 400));

  const analytics = await Project.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(projectId) } },
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
        }
      }
    },
    {
      $addFields: {
        progress: {
          $cond: [
            { $eq: ['$totalTasks', 0] },
            0,
            { $round: [{ $multiply: [{ $divide: ['$completedTasks', '$totalTasks'] }, 100] }, 0] }
          ]
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalTasks: 1,
        completedTasks: 1,
        progress: 1
      }
    }
  ]);

  if (!analytics.length) return next(new AppError('Project not found', 404));

  return res.status(200).json({
    status: 'success',
    data: analytics[0]
  });
});

// Get all projects assigned to a manager
const getManagerProjects = catchAsync(async (req, res, next) => {
  const devId = req.user._id;
  const { status } = req.query;

  if (!mongoose.Types.ObjectId.isValid(devId)) return next(new AppError('Invalid developer ID', 400));

  // Build match condition dynamically
  const match = { managerId: new mongoose.Types.ObjectId(devId) };
  if (status) match.status = status;

  const projects = await Project.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
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
    {
      $project: {
        tasks: 0, // Exclude tasks from final output
      }
    }
  ]);

  return res.status(200).json({
    status: 'success',
    results: projects.length,
    data: projects
  });
});
const getClientProjects = catchAsync(async (req, res, next) => {
  const devId = req.user._id;
  const { status } = req.query;

  if (!mongoose.Types.ObjectId.isValid(devId)) return next(new AppError('Invalid developer ID', 400));

  // Build match condition dynamically
  const match = { clientId: new mongoose.Types.ObjectId(devId) };
  if (status) match.status = status;

  const projects = await Project.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'managerId',
        foreignField: '_id',
        as: 'manager'
      }
    },
    { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
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
    {
      $project: {
        tasks: 0, // Exclude tasks from final output
      }
    }
  ]);

  return res.status(200).json({
    status: 'success',
    results: projects.length,
    data: projects
  });
});


const updateProjectStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Pending', 'Ongoing', 'Completed', 'On Hold'].includes(status)) {
    return next(new AppError('Invalid project status.', 400));
  }

  const project = await Project.findByIdAndUpdate(id, { status }, { new: true });
  if (!project) return next(new AppError('Project not found.', 404));

  return res.status(200).json({
    status: 'success',
    message: 'Project status updated successfully',
    data: project
  });
});


module.exports = {
  updateProjectStatus,
  getManagerProjects,
  getProjectAnalytics,
  deleteProject,
  assignTasks,
  getProject,
  getAllProjects,
  updateProject,
  createProject,
  getClientProjects

}