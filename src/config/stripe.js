const stripe = require('stripe')(process.env.STRIPE_SECRET_ACCESS_KEY);

module.exports = stripe;
