const cors = require('cors');
const express = require('express');
const path = require('path');
// const logger = require('morgan');
require('dotenv').config();
// const rateLimit = require('express-rate-limit');
// const helmet = require('helmet');
// const mongoSanitize = require('express-mongo-sanitize');
// const xss = require('xss-clean');
// const hpp = require('hpp');
// const cookieParser = require('cookie-parser');
// const compression = require('compression');
// const qs = require('qs');
// const autoDeleteOldPendingBookings = require('../jobs/autoDeleteOldPendingBookings');
// const updateBookingStatus = require('../jobs/updateBookingStatus');

module.exports = (app) => {
  app.use(cors());
  app.options('*', cors());
  // app.use(helmet({ contentSecurityPolicy: false }));
  // app.use(cookieParser());
  // app.use(xss());
  // app.use(compression());
  app.use('/public', express.static(path.join(__dirname, '../public')));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  // app.set('query parser', (str) => qs.parse(str));
  // if (process.env.NODE_ENV === 'development') {
  //   app.use(logger('dev'));
  // }

  // app.use(mongoSanitize());
  // const limiter = rateLimit({
  //   max: 90000,
  //   windowMs: 15 * 60 * 1000, // 15 minutes
  //   message: 'Too many requests from this IP, please try again in 15 mintues!'
  // });
  // app.use('/api', limiter);
  // app.use(
  //   hpp({
  //     whitelist: []
  //   })
  // );
  // Test middleware
  app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
  });
};
