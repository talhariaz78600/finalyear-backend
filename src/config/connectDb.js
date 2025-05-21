const mongoose = require('mongoose');
// const populateAmenities = require('../utils/populateAmenities');
// const populateServiceCategory = require('../utils/poplateServiceCategory');
// const populateServiceGadgets = require('../utils/populateServiceGadgets');
const populateNotificationSetting = require('../utils/NotificationSetting');
require('dotenv').config();
require('colors');

//  connect MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      connectTimeoutMS: 60000
    });
    console.log('Connected to MongoDB'.green.bold);
    // populateAmenities()
    // populateServiceCategory()
    // populateServiceGadgets()
    // populateNotificationSetting()
  } catch (error) {
    console.error('Error connecting to MongoDB:'.red.bold, error.message);
  }
};

module.exports = { connectDB };
