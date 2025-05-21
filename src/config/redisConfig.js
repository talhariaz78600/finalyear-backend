const { createClient } = require('redis');
require('colors');

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    connectTimeout: 10000, // 10 seconds
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
  }
});

const connectRedis = async () => {
  try {
    await redisClient.connect();

    console.log('Connected to Redis'.blue.bold);
  } catch (error) {
    console.error('Could not connect to Redis', error);
  }
};

redisClient.on('error', (err) => console.error('Redis Error', err));
redisClient.on('end', () => {
  console.warn('Redis connection closed.');
});

redisClient.on('reconnecting', () => {
  console.info('Attempting to reconnect to Redis...');
});
module.exports = { connectRedis, redisClient };
