// models/Project.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projectSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ['Pending', 'Ongoing', 'Completed', 'On Hold'],
    default: 'Pending',
  },
  deadline: { type: Date },
  docs: {
    type: String, // URL or path to project documents
    trim: true,
  },
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  progress: { type: Number, default: 0 }, // 0 to 100

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

module.exports = mongoose.model('Project', projectSchema);
