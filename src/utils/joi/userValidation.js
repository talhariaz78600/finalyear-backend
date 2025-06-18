const Joi = require('joi');
const { roles } = require('../types');

const base = {
  firstName: Joi.string().trim().max(50),
  lastName: Joi.string().trim().max(50),
  email: Joi.string().email().trim(),
  contact: Joi.string(),
  password: Joi.string().min(6),
  role: Joi.string().valid(...Object.values(roles)),
  status: Joi.string().valid('Active', 'Inactive', 'Suspend', 'Delete')
};

exports.userCreateSchema = Joi.object(base).fork(
  ['firstName','lastName','email','password','role'], s => s.required()
);

exports.userUpdateSchema = Joi.object(base);
