const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SubscriptionPlan = require('../models/SubscriptionPlan');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  .then(() => console.log('DB connection successful!'));

const plans = [
  // Student Plans
  {
    name: 'free',
    duration: 'monthly',
    price: 0,
    userType: 'student',
    permissions: {
      ads: true,
      storageLimit: 1,
      maxTopicsPerDay: 3,
      customization: false,
      handsUpLimit: 1,
      gifsEnabled: false,
      priorityVisibility: false
    }
  },
  {
    name: 'premium',
    duration: 'monthly',
    price: 9.99,
    userType: 'student',
    permissions: {
      ads: false,
      storageLimit: 4,
      maxTopicsPerDay: 10,
      customization: true,
      handsUpLimit: 1,
      gifsEnabled: true,
      priorityVisibility: true
    }
  },
  // Musician Plans
  {
    name: 'free',
    duration: 'monthly',
    price: 0,
    userType: 'musician',
    permissions: {
      ads: true,
      storageLimit: 1,
      maxTopicsPerDay: 3,
      customization: false,
      handsUpLimit: 1,
      gifsEnabled: false,
      priorityVisibility: false
    }
  },
  {
    name: 'essential',
    duration: 'monthly',
    price: 9.99,
    userType: 'musician',
    permissions: {
      ads: false,
      storageLimit: 5,
      maxTopicsPerDay: 10,
      customization: true,
      handsUpLimit: 2,
      gifsEnabled: true,
      priorityVisibility: true
    }
  },
  {
    name: 'professional',
    duration: 'monthly',
    price: 19.99,
    userType: 'musician',
    permissions: {
      ads: false,
      storageLimit: 10,
      maxTopicsPerDay: 20,
      customization: true,
      handsUpLimit: 3,
      gifsEnabled: true,
      priorityVisibility: true
    }
  },
  // Contractor Plans
  {
    name: 'free',
    duration: 'monthly',
    price: 0,
    userType: 'contractor',
    permissions: {
      ads: true,
      storageLimit: 1,
      maxTopicsPerDay: 3,
      customization: false,
      handsUpLimit: 1,
      gifsEnabled: false,
      priorityVisibility: false
    }
  },
  {
    name: 'essential',
    duration: 'monthly',
    price: 9.99,
    userType: 'contractor',
    permissions: {
      ads: false,
      storageLimit: 5,
      maxTopicsPerDay: 10,
      customization: true,
      handsUpLimit: 2,
      gifsEnabled: true,
      priorityVisibility: true
    }
  },
  {
    name: 'professional',
    duration: 'monthly',
    price: 19.99,
    userType: 'contractor',
    permissions: {
      ads: false,
      storageLimit: 10,
      maxTopicsPerDay: 20,
      customization: true,
      handsUpLimit: 3,
      gifsEnabled: true,
      priorityVisibility: true
    }
  }
];

const importData = async () => {
  try {
    await SubscriptionPlan.deleteMany();
    await SubscriptionPlan.insertMany(plans);
    console.log('Data successfully loaded!');
    throw new Error('Data import failed!');
  } catch (err) {
    console.error(err);
    throw new Error('Data import failed!');
  }
};

importData();
