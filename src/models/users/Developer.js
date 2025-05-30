const { Schema } = require('mongoose');
const User = require('./User');

const developerSchema = new Schema({
  permissions: [String],
  skills: [String],
  projectsWorkedOn: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Project'
    }
  ],
});

module.exports = User.discriminator('developer', developerSchema);
