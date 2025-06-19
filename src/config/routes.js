const express = require('express');
const {
  authRoute,
  userRoute,
  projectRoute

} = require('../routes');

const otherRoutes = require('./otherRoutes');


module.exports = (app) => {

  app.use(express.json({ limit: '30mb' }));
  app.use('/api/auth', authRoute);
  app.use('/api/user', userRoute);
  app.use('/api/project', projectRoute);
  app.get('/', (req, res) => {
    res.send('OK');
  });

  otherRoutes(app);
};
