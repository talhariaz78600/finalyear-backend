const { Schema } = require('mongoose');
const User = require('./User');

const customerSchema = new Schema({
  // gender: {
  //   type: String,
  //   trim: true,
  //   enum: ["Male", "Female", "Non binary"],
  // },
  permissions: [String],
  favouriteListings: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Listing'
    }
  ],
  totalFavouriteListings: {
    type: Number,
    default: 0
  },
  bookingHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Booking'
    }
  ],
  reviewsReceived: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Review'
    }
  ],
  reviewsGiven: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Review'
    }
  ],
  isVerified: {
    type: Boolean,
    default: false
  },
  paymentMethodid:{
    type:String,
    trim:true
  },
  stripeCustomerId:{
    type:String,
    trim:true
  },
  paymentHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Payment'
    }
  ]
});

module.exports = User.discriminator('customer', customerSchema);
