const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const requireAuth = require('../middlewares/requireAuth');
const { roles } = require('../utils/types');
router.use(requireAuth);
router.post('/',  taskController.createTask);
router.get('/project/:projectId',  taskController.getTasks);
router.get('/:id',  taskController.getTask);
router.patch('/:id',  taskController.updateTask);
router.delete('/:id',  taskController.deleteTask);

module.exports = router;