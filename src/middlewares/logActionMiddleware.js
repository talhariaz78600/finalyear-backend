const Log = require('../models/Logs');
const logActionMiddleware = (action, target = null) => async (req, res, next) => {
  res.on('finish', async () => {
    try {
      // Only log if response status is 2xx (success)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await Log.create({
          actorId: req?.user?._id || res.locals?.actor?._id || null,
          actorModel: req?.user?.role?.toLowerCase() || res.locals?.actor?.role?.toLowerCase() || 'unknown',
          action,
          target,
          targetId: res.locals?.dataId || null,
          description: `${req.user?.role?.toLowerCase() || res.locals?.actor?.role || 'unknown'} performed ${action} on ${target || 'system'}`
        });
      }
    } catch (err) {
      console.error('Failed to log action:', err.message);
    }
  });

  next();
};

module.exports = logActionMiddleware;