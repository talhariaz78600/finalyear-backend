const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const notificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User' },
  title: String,
  message: String,
  read: { type: Boolean, default: false },
  link: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Notification',notificationSchema);