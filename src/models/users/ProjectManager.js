const { Schema } = require('mongoose');
const User = require('./User');

const projectManagerSchema = new Schema({
  managedProjects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
  department: { type: String }, // optional field
  designation: { type: String }, // e.g. 'Senior PM'
  experienceYears: { type: Number }, // optional field
});

module.exports = User.discriminator('ProjectManager', projectManagerSchema);
