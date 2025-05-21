const { Schema } = require('mongoose');
const User = require('./User');


const adminSchema = new Schema({
  adminRole: {
    type: String,
    enum: ['admin', 'subAdmin'],
    default: 'subAdmin'
  },
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'Permission',
    required: [
      function() {
        // only required when adminRole is 'subAdmin'
        return this.adminRole === 'subAdmin';
      },
      'templateId is required when adminRole is subAdmin'
    ]
  },
  tasks: [{
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  }],
  JobTitle: { type: String, trim: true },

  assignedDepartments: {
    type: [String],
    default: []
  }

});

module.exports = User.discriminator('admin', adminSchema);
