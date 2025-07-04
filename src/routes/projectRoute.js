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
  createProject,
  getClientProjects
} = require('../controllers/projectController');

const { roles } = require('../utils/types');

const router = express.Router();

router.use(requireAuth);

router.post('/', restrictTo(roles.ADMIN), createProject);

router.patch('/:id', restrictTo(roles.ADMIN), updateProject);

router.delete('/:id', restrictTo(roles.ADMIN), deleteProject);

router.patch('/task/:id/assign-tasks', restrictTo(roles.ADMIN), assignTasks);

router.patch('/:id/status', restrictTo([roles.ADMIN, roles.PROJECT_MANAGER]), updateProjectStatus);

router.get('/', restrictTo([roles.ADMIN]), getAllProjects);

router.get('/:id', getProject);

router.get('/analytics/data', restrictTo([roles.ADMIN]), getProjectAnalytics);

router.get('/manager/my-projects', restrictTo([roles.PROJECT_MANAGER]), getManagerProjects);

router.get('/client/my-projects', restrictTo([roles.CLIENT]), getClientProjects);

module.exports = router;
