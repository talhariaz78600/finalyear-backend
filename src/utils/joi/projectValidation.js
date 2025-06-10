const Joi = require("joi");

const projectSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().trim(),
  status: Joi.string().valid('Pending', 'Ongoing', 'Completed'),
  clientId: Joi.string().hex().length(24),
  managerId: Joi.string().hex().length(24),
  tasks: Joi.array().items(Joi.string().hex().length(24)).default([]),
})
// .fork(['title', 'description', 'status', 'clientId', 'managerId'], schema => schema.required());

module.exports = { projectSchema };