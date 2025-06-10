const Joi = require("joi");

const taskSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().trim(),
  status: Joi.string().valid('Pending', 'Assigned', 'In Progress', 'Completed'),
  assignedTo: Joi.string().hex().length(24),
  deadline: Joi.date(),
  projectId: Joi.string().hex().length(24),
})
// .fork(['title', 'description', 'status', 'assignedTo', 'deadline', 'projectId'], schema => schema.required());

module.exports={taskSchema}