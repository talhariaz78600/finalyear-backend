const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const restrictTo = require('../middlewares/restrictTo');
const {
  updateProjectStatus,
  getManagerProjects,
  getProjectAnalytics,
  deleteProject,
  assignTasks,
  getProject,
  getAllProjects,
  updateProject,
  createProject
} = require('../controllers/projectController');

const { roles } = require('../utils/types');

const router = express.Router();

router.use(requireAuth);

router.post('/', restrictTo(roles.ADMIN), createProject);

router.patch('/:id', restrictTo(roles.ADMIN), updateProject);

router.delete('/:id', restrictTo(roles.ADMIN), deleteProject);

router.patch('/:id/assign-tasks', restrictTo(roles.ADMIN), assignTasks);

router.patch('/:id/status', restrictTo(roles.ADMIN, roles.MANAGER), updateProjectStatus);

router.get('/', restrictTo(roles.ADMIN), getAllProjects);

router.get('/:id', getProject);

router.get('/analytics/data', restrictTo(roles.ADMIN), getProjectAnalytics);

router.get('/manager/my-projects', restrictTo(roles.MANAGER), getManagerProjects);

module.exports = router;
