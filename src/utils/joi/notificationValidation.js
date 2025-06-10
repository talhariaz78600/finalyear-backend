const notificationSchema = Joi.object({
  title: Joi.string().trim(),
  message: Joi.string().trim(),
  type: Joi.string().valid('info', 'warning', 'alert'),
  recipientId: Joi.string().hex().length(24),
  isRead: Joi.boolean().default(false),
  createdAt: Joi.date().default(Date.now),
})
// .fork(['title', 'message', 'type', 'recipientId'], schema => schema.required());

module.exports = { notificationSchema };