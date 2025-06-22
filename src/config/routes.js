// config/routes.js
const {
  authRoute,
  userRoute,
  projectRoute,
  logsRoute,
  taskRoute
} = require('../routes');
// const otherRoutes = require('./otherRoutes');

module.exports = (app) => {
  app.use('/api/auth', authRoute);
  app.use('/api/user', userRoute);
  app.use('/api/project', projectRoute);
  app.use('/api/logs', logsRoute);
  app.use('/api/task', taskRoute);


};
