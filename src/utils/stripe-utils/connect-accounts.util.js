const { STRIPE_SECRET_ACCESS_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_ACCESS_KEY);

module.exports = {
  async createStripeExpressAccount(params) {
    try {
      const { email, country, userId } = params;
      const payload = {
        type: 'express',
        email,
        country,
        capabilities: {
          card_payments: {
            requested: true
          },
          transfers: {
            requested: true
          }
        },
        metadata: {
          userId: userId?.toString()
        }
      };


      const account = await stripe.accounts.create(payload);
      return account.id;
    } catch (err) {
      // logger.error(`In createStripeAccountExpress - ${JSON.stringify(err)}`);
      throw new Error(err);
    }
  },

  async createStripeOnBoardingLink(params) {
    try {
      const { accountId } = params;
      const accountLinks = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: process.env.STRIPE_REFRESH_URL,
        return_url: process.env.FRONTEND_URL,
        type: 'account_onboarding'
      });
      return accountLinks.url;
    } catch (err) {
      // logger.error(`In createStripeAccountExpress - ${JSON.stringify(err)}`);
      throw new Error(err);
    }
  },

  async createPaymentIntents(params) {
    try {
      const { amount, currency, paymentMethodId, customerId } = params;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        payment_method: paymentMethodId,
        customer: customerId,
        confirm: true,
        capture_method: 'manual', // ⛔ prevent immediate capture
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      });
      
      return paymentIntent;
    } catch (err) {
      // logger.error(`In createStripeAccountExpress - ${JSON.stringify(err)}`);
      throw new Error(err);
    }
  }
};

