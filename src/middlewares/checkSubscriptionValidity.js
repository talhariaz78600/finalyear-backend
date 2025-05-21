const Subscription = require('../models/Subscription');
const AppError = require('../utils/appError');

const getPermissionsByUserType = (userType, plan) => {
  const permissions = {
    student: {
      free: {
        ads: true,
        storageLimit: 1,
        maxTopicsPerDay: 3,
        customization: false,
        handsUpLimit: 1,
        gifsEnabled: false,
        priorityVisibility: false
      },
      premium: {
        ads: false,
        storageLimit: 4,
        maxTopicsPerDay: 10,
        customization: true,
        handsUpLimit: 1,
        gifsEnabled: true,
        priorityVisibility: true
      }
    },
    musician: {
      free: {
        ads: true,
        storageLimit: 1,
        maxTopicsPerDay: 3,
        customization: false,
        handsUpLimit: 1,
        gifsEnabled: false,
        priorityVisibility: false
      },
      essential: {
        ads: false,
        storageLimit: 5,
        maxTopicsPerDay: 10,
        customization: true,
        handsUpLimit: 2,
        gifsEnabled: true,
        priorityVisibility: true
      },
      professional: {
        ads: false,
        storageLimit: 10,
        maxTopicsPerDay: 20,
        customization: true,
        handsUpLimit: 3,
        gifsEnabled: true,
        priorityVisibility: true
      }
    },
    contractor: {
      free: {
        ads: true,
        storageLimit: 1,
        maxTopicsPerDay: 3,
        customization: false,
        handsUpLimit: 1,
        gifsEnabled: false,
        priorityVisibility: false
      },
      essential: {
        ads: false,
        storageLimit: 5,
        maxTopicsPerDay: 10,
        customization: true,
        handsUpLimit: 2,
        gifsEnabled: true,
        priorityVisibility: true
      },
      professional: {
        ads: false,
        storageLimit: 10,
        maxTopicsPerDay: 20,
        customization: true,
        handsUpLimit: 3,
        gifsEnabled: true,
        priorityVisibility: true
      }
    }
  };

  return permissions[userType][plan];
};

const checkSubscriptionValidity = async (req, res, next) => {
  const userId = req.user._id;
  const subscription = await Subscription.findOne({ userId });

  if (!subscription) {
    return next(new AppError('No subscription found for this user.', 404));
  }

  if (subscription.expiryDate < new Date()) {
    subscription.isActive = false;
    subscription.type = 'free';
    subscription.verifiedBadge = false;
    subscription.permissions = getPermissionsByUserType(req.user.role, 'free');
    await subscription.save();
  }

  req.subscription = subscription;
  return next();
};

module.exports = checkSubscriptionValidity;
