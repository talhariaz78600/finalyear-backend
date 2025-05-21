const { Schema } = require('mongoose');
const User = require('./User');

const vendorSchema = new Schema({
  permissions: [String],
  stripeAccountId: {
    type: String,
    trim: true
  },
  accountStatus: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  textForumStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', "inprogress"],
    default: 'pending'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  customPricingPercentage: {
    type: Number,
    validate: {
      validator(value) {
        return value >= 0 && value <= 100;
      },
      message: 'customPricingPercentage must be between 0 and 100'
    }
  }
});

module.exports = User.discriminator('vendor', vendorSchema);
