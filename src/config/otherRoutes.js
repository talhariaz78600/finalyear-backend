// config/startServer.js

require('dotenv').config();
const http = require('http');
const AppError = require('../utils/appError');
const globalErrorHandler = require('../controllers/errorController');
// const { initializeSocket } = require('../utils/socket');

module.exports = (app) => {
  // Middleware: Track request time
  app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
  });

  // Health check
  app.get('/', (req, res) => {
    res.send('API is Working.............');
  });

  // 404 handler
  app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  });

  // Global error handler
  app.use(globalErrorHandler);

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize socket if needed
  // initializeSocket(server);

  // Start listening
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Example app listening on port ${port}!`);
  });
};
