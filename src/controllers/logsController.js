
const mongoose = require('mongoose');
const Logs = require('../models/Logs');
const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const getAllLogs = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const query = {
        actorId: id
    };
    const apiFeature = new APIFeatures(Logs.find(query), req.query).paginate().sort();

    const [total, logs] = await Promise.all([
        Logs.countDocuments(query),
        apiFeature.query.populate("actorId",["email","profileCompleted","lastName","firstName"]).populate("targetId")
    ]);

    res.status(200).json({
        status: "success",
        results: logs.length,
        page: Number(page),
        limit: Number(limit),
        logs,
        totalLogs: total
    });
});

module.exports = {
    getAllLogs
};

