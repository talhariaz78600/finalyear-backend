const express = require('express');
const {
    getAllLogs
} = require('../controllers/logsController');
const requireAuth = require('../middlewares/requireAuth');
const restrictTo = require('../middlewares/restrictTo');



const router = express.Router();


router.route('/:id').get(requireAuth, restrictTo(['admin']), getAllLogs);






module.exports = router;