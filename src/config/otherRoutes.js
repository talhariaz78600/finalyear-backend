// config/startServer.js

require('dotenv').config();
const http = require('http');
const AppError = require('../utils/appError');
const globalErrorHandler = require('../controllers/errorController');
const { initializeSocket } = require('../utils/socket');
const { default: OpenAI } = require('openai');

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
  const openai = new OpenAI({
    baseURL: 'https://models.github.ai/inference',
    apiKey: "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",
  });
  const MODEL = "openai/gpt-4.1-mini";
  app.post('/api/chat', async (req, res) => {
    const { prompt } = req.body;
    console.log('Received prompt:', prompt);

    try {
      const response = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 1.0,
        top_p: 1.0,
        model: MODEL,
      });

      res.json({ message: response?.choices[0]?.message?.content });
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Failed to get response from model' });
    }
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
  initializeSocket(server);

  // Start listening
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Example app listening on port ${port}!`);
  });
};
