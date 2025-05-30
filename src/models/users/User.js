const { Schema, model, default: mongoose } = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const validator = require('validator');
const { PhoneNumberUtil } = require('google-libphonenumber');
const { TypeCheck } = require('../../utils/helpers');
const { roles } = require('../../utils/types');


const phoneUtil = PhoneNumberUtil.getInstance();

function toLower(email) {
  if (!email || !TypeCheck(email).isString()) return email;
  return email.toLowerCase();
}

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      unique: true,
      required: true,
      set: toLower,
      validate: [validator.isEmail, 'Please provide a valid email'],
      trim: true
    },
    contact: {
      type: String,
      trim: true,
      // required: true,
      validate: {
        validator(value) {
          if (!value) return true;
          try {
            const number = phoneUtil.parseAndKeepRawInput(value);
            return phoneUtil.isValidNumber(number);
          } catch (error) {
            return false;
          }
        },
        message: 'Invalid phone number for the specified country'
      }
    },
    password: {
      type: String,
      select: false,
      trim: true
    },
    profilePicture: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: [roles.ADMIN, roles.CLIENT, roles.DEVELOPER, roles.PROJECT_MANAGER],
      required: true
    },

    profileCompleted: {
      type: Boolean,
      default: false
    },
    OTP: {
      type: String
    },
    city: {
      type: Schema.Types.ObjectId,
      ref: 'City'
    },
    country: {
      type: Schema.Types.ObjectId,
      ref: 'Country'
    },
    address: {
      mailingAddress: {
        type: String,
        trim: true
      }
    },
    status: {
      type: String,
      trim: true,
      enum: ["Active", "Inactive", "Suspend", "Delete"],
      default: "Active"
    },


    lastLoginAt: Date,
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    otpVerifiedAt: Date,
    otpExpiration: String,
    deactivatedAt: Date,
    lastSeen: Date
  },
  {
    discriminatorKey: 'role',
    timestamps: true,
    virtuals: true
  }
);
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save hook for hashing password or storing provider ID
userSchema.pre('save', async function (next) {
  // if (this.providers.includes("local")) {
  // If the provider is local, hash the password
  if (!this.isModified('password')) return next();

  if (!this.password) {
    return next(new Error('Password is required for local users.'));
  }

  // Example validation for password complexity (you can customize this)
  if (this.password.length < 6) {
    return next(new Error('Password must be at least 6 characters long.'));
  }

  // Hash the password
  this.password = await bcrypt.hash(this.password, 12);

  // Update passwordChangedAt timestamp if the document is being updated
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }

  return next();

});

userSchema.methods.comparePasswords = async function (comingPassword, userPassword) {
  // eslint-disable-next-line no-return-await
  return await bcrypt.compare(comingPassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};


module.exports = model('User', userSchema);
