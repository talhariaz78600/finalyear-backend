// models/SubAdminRole.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const subAdminRoleSchema = new Schema({
  name: { type: String, required: true, unique: true }, // e.g., HR, Finance, IT
  permissions: [{ type: String }], // e.g., ['manageUsers', 'viewReports']
  assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SubAdminRole', subAdminRoleSchema);
