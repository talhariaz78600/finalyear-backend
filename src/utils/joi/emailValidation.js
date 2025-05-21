const Joi = require('joi');

const emailVerifySchema = Joi.object({
  email: Joi.string().email().messages({
    'string.email': 'Email must be a valid email.',
    'any.required': 'Email is required.'
  })
});

const emailOTPVerifySchema = Joi.object({
  email: Joi.string().email().messages({
    'string.email': 'Email must be a valid email.',
    'any.required': 'Email is required.'
  }),
  otp: Joi.number().messages({
    'any.required': 'Email is required.'
  })
});
const LoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email.',
    'any.required': 'Email is required.'
  }),

  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long.',
    'any.required': 'Password is required.'
  })
});

module.exports = { emailVerifySchema, emailOTPVerifySchema, LoginSchema };
