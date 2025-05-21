const { STRIPE_SECRET_ACCESS_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_ACCESS_KEY);

module.exports = {
  createPaymentMethod: async () => {
    try {
      const transfer = await stripe.transfers.create({
        amount: 400,
        currency: 'usd',
        destination: 'acct_1MTfjCQ9PRzxEwkZ',
        transfer_group: 'ORDER_95'
      });
      console.log('transfer response', transfer);
    } catch (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }
  },

  attachPaymentMethod: async (params) => {
    const { paymentMethodId, customerId } = params;
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error) {
      console.error('Error attaching payment method:', error);
      throw error;
    }
  },

  detachPaymentMethod: async (params) => {
    const { paymentMethodId } = params;
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      console.error('Error detaching payment method:', error);
      throw error;
    }
  },
  maintoConnect: async (params) => {
    const { vendor, amountInCents } = params;

    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        destination: vendor.stripeAccountId,
        description: `Manual payout to vendor (${vendor.email})`,
      });
      return transfer;
    } catch (error) {
      console.error('Stripe transfer error:', error);
      throw error;
    }
  }
};
