const express = require('express');
const {
  authRoute,
  userRoute,
  projectRoute,
  logsRoute,
  taskRoute
} = require('../routes');

const otherRoutes = require('./otherRoutes');


module.exports = (app) => {

  app.use(express.json({ limit: '30mb' }));
  app.use('/api/auth', authRoute);
  app.use('/api/user', userRoute);
  app.use('/api/project', projectRoute);
  app.use('/api/logs', logsRoute);
  app.use('/api/task', taskRoute);
  app.get('/', (req, res) => {
    res.send('OK');
  });

  otherRoutes(app);
};
