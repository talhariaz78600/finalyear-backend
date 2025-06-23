const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const { getUser, getUsers, updateUser, deleteUser, updateStatus, getDashboardStats, createUser, getUsersName, getMe, updateMe } = require('../controllers/userController');

const restrictTo = require('../middlewares/restrictTo');
const { roles } = require('../utils/types');
const router = express.Router();
router.use(requireAuth);

router.get('/me', getMe);
router.patch('/me', updateMe);

router.get('/stats', restrictTo([roles.ADMIN]), getDashboardStats);

router.patch('/status/:id', restrictTo([roles.ADMIN]), updateStatus);

router.route('/')
  .get(restrictTo([roles.ADMIN, roles.PROJECT_MANAGER, roles.DEVELOPER]), getUsers)
  .post(restrictTo([roles.ADMIN]), createUser);

router.get('/names', restrictTo([roles.ADMIN,roles.PROJECT_MANAGER]), getUsersName);
router.route('/:id')
  .get(restrictTo([roles.ADMIN]), getUser)
  .patch(restrictTo([roles.ADMIN]), updateUser)
  .delete(restrictTo([roles.ADMIN]), deleteUser);


module.exports = router;

