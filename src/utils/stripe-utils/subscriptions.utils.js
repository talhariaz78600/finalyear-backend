const { STRIPE_SECRET_ACCESS_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_ACCESS_KEY);

module.exports = {
  createSubscription: async (params) => {
    const { customerId, priceId } = params;
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: priceId
          }
        ],
        payment_behavior: 'error_if_incomplete'
      });
      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  cancelSubscription: async (params) => {
    const { subscriptionId } = params;
    try {
      const cancelSubscription = await stripe.subscriptions.cancel(subscriptionId);
      console.log('cancelSubscription', cancelSubscription);
      return cancelSubscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  getSubscription: async (params) => {
    const { subscriptionId } = params;
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  },

  getSubscriptions: async (params) => {
    const { customerId } = params;
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId
      });
      return subscriptions;
    } catch (error) {
      console.error('Error retrieving subscriptions:', error);
      throw error;
    }
  },

  getSubscriptionStatus: async (params) => {
    const { subscriptionId } = params;
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription.status;
    } catch (error) {
      console.error('Error retrieving subscription status:', error);
      throw error;
    }
  },

  upgradeSubscription: async (params) => {
    const { subscriptionId, newPriceId } = params;
    try {
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{ price: newPriceId }]
      });
      return updatedSubscription;
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  },

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
