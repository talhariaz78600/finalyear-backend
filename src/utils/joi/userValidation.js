const Joi = require('joi');
const { roles } = require('../types');

const registerUserSchema = Joi.object({

  email: Joi.string()
    .email()
    .when('provider', {
      is: 'local',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.email': 'Email must be a valid email.',
      'any.required': 'Email is required.'
    }),

  password: Joi.string()
    .min(6)
    .when('provider', {
      is: 'local',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.min': 'Password must be at least 6 characters long.',
      'any.required': 'Password is required.'
    }),

  firstName: Joi.string().required().messages({
    'any.required': 'First name is required.'
  }),

  lastName: Joi.string().required().messages({
    'any.required': 'Last name is required.'
  }),

  contact: Joi.string().required().messages({
    'any.required': 'Contact number is required.'
  }),

  countryCode: Joi.string().required().messages({
    'any.required': 'Country code is required.'
  }),


  role: Joi.string().valid(roles.ADMIN, roles.CLIENT, roles.DEVELOPER, roles.PROJECT_MANAGER).required().messages({
    'any.required': 'Role is required.',
    'any.only': 'Invalid user type.'
  }),


});



const validateUserProfile = (data, options = { partial: false }) => {
  const schema = Joi.object({
    firstName: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .when('$partial', { is: false, then: Joi.required() }),
    lastName: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .when('$partial', { is: false, then: Joi.required() }),

    // Contact Information
    contact: Joi.string().when('$partial', { is: false, then: Joi.required() }).messages({
      'any.required': 'Contact number is required'
    }),


    countryCode: Joi.string()
      .when('contact', {
        is: Joi.exist(),
        then: Joi.string()
          .pattern(/^\+\d{1,4}$/)
          .required()
      })
      .messages({
        'string.pattern.base': 'Invalid country code format',
        'any.required': 'Country code is required when providing contact number'
      }),

    profilePicture: Joi.string()
      .trim()
      .uri()
      .when('$partial', { is: false, then: Joi.required() }),

  }).options({ allowUnknown: true });

  return schema.validate(data, {
    context: { partial: options.partial }
  });
};
module.exports = { registerUserSchema, validateUserProfile };
