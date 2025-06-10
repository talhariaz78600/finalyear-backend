const { Schema } = require('mongoose');
const User = require('./User');

const developerSchema = new Schema({
  skills: [{ type: String }], // Example: ['React', 'Node.js', 'MongoDB']
  assignedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  experienceYears: { type: Number },
  currentProject: { type: Schema.Types.ObjectId, ref: 'Project' },
  availabilityStatus: {
    type: String,
    enum: ['available', 'busy', 'on leave'],
    default: 'available',
  },
});

module.exports = User.discriminator('Developer', developerSchema);
