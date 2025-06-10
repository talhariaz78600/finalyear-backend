const { Schema } = require('mongoose');
const User = require('./User');

const adminSchema = new Schema({
  adminRole: {
    type: String,
    enum: ['admin', 'subAdmin'],
    default: 'subAdmin'
  },
  // Only used for subAdmin to attach permissions template
  subAdminRoleTemplate: {
    type: Schema.Types.ObjectId,
    ref: 'SubAdminRole',
    required: [
      function () {
        return this.adminRole === 'subAdmin';
      },
      'subAdminRoleTemplate is required when adminRole is subAdmin'
    ]
  },
  assignedProjects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project'
  }],
  assignedTasks: [{
    type: Schema.Types.ObjectId,
    ref: 'Task'
  }],
  jobTitle: { type: String, trim: true },

  assignedDepartments: {
    type: [String], // or you can normalize and use ObjectId refs to `Department` model
    default: []
  }
});

module.exports = User.discriminator('admin', adminSchema);
