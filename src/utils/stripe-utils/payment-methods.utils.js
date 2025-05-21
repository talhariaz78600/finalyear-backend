const { STRIPE_SECRET_ACCESS_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_ACCESS_KEY);

module.exports = {
  createPaymentMethod: async (params) => {
    const { customerId, card } = params;
    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: card.number,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          cvc: card.cvc
        }
      });
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });
      return paymentMethod;
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
  }
};
