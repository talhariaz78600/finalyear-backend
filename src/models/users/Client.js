const { Schema } = require('mongoose');
const User = require('./User');

const clientSchema = new Schema({

  companyName: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  projects: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Project'
    }
  ],
  billingInfo: {
    type: String,
    trim: true
  },
  preferences: {
    type: Object,
    default: {}
  }

});

module.exports = User.discriminator('client', clientSchema);
