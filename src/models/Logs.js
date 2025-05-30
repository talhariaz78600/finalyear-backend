// models/Log.js
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'actorModel'
  },
  actorModel: {
    type: String,
    required: true,
    enum: ['customer', 'vendor', 'admin']
  },
  action: {
    type: String,
    required: true // e.g. 'CREATE_SERVICE', 'DELETE_BOOKING', 'LOGIN', etc.
  },
  target: {
    type: String,
    default: null // e.g. 'Service', 'Booking', 'UserProfile', etc.
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'target'
  },
  description: {
    type: String,
    default: null // e.g. 'Created a new service', 'Deleted a booking', etc.
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Log', logSchema);
