const { Schema } = require('mongoose');
const User = require('./User');

const projectManagerSchema = new Schema({
  permissions: [String],
    projectsManaged: [
        {
        type: Schema.Types.ObjectId,
        ref: 'Project'
        }
    ],
});

module.exports = User.discriminator('projectManager', projectManagerSchema);
