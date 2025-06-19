const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const restrictTo = require('../middlewares/restrictTo');
const {
  updateProjectStatus,
  assignDeveloperToProject,
  getDeveloperProjects,
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

router.post('/', restrictTo(roles.ADMIN, roles.MANAGER), createProject);

router.patch('/:id', restrictTo(roles.ADMIN, roles.MANAGER), updateProject);

router.delete('/:id', restrictTo(roles.ADMIN), deleteProject);

router.patch('/:id/assign-developer', restrictTo(roles.ADMIN, roles.MANAGER), assignDeveloperToProject);

router.patch('/:id/assign-tasks', restrictTo(roles.ADMIN, roles.MANAGER), assignTasks);

router.patch('/:id/status', restrictTo(roles.ADMIN, roles.MANAGER), updateProjectStatus);

router.get('/', restrictTo(roles.ADMIN, roles.MANAGER, roles.SUBADMIN), getAllProjects);

router.get('/:id', getProject);

router.get('/analytics/data', restrictTo(roles.ADMIN), getProjectAnalytics);

router.get('/developer/my-projects', restrictTo(roles.DEVELOPER), getDeveloperProjects);

module.exports = router;
