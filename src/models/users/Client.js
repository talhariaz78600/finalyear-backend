const { Schema } = require('mongoose');
const User = require('./User');

const clientSchema = new Schema({
  companyName: { type: String },
  contactNumber: { type: String },
  address: { type: String },
  projects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
  joinedDate: { type: Date, default: Date.now },
  notes: { type: String }, // Optional notes from the org/admin about this client
});

module.exports = User.discriminator('client', clientSchema);
