const { verify } = require('jsonwebtoken');

const { STRIPE_SECRET_ACCESS_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_ACCESS_KEY);

module.exports = {
  createCustomer: async (params) => {
    const { email, name } = params;
    try {
      const customer = await stripe.customers.create({
        email,
        name
      });
      return customer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw new Error(error);
    }
  },



  attachPaymentMethod: async (params) => {
    const { paymentMethodId, customerId } = params;
    try {
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      return paymentMethod;
    } catch (error) {
      console.error('Error attaching payment method:', error);
      throw new Error(error);
    }
  },

  getCustomer: async (params) => {
    const { customerId } = params;
    try {
      const customer = await stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      console.error('Error retrieving customer:', error);
      throw new Error(error);
    }
  },

  updateCustomer: async (params) => {
    const { stripeCustomerId, paymentMethodid } = params;
    try {
      // Set default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodid
        }
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      throw new Error(error);
    }
  },

  deleteCustomer: async (params) => {
    const { customerId } = params;
    try {
      const customer = await stripe.customers.del(customerId);
      return customer;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw new Error(error);
    }
  },

  listCustomers: async (params) => {
    const { limit } = params;
    try {
      const customers = await stripe.customers.list({
        limit
      });
      return customers;
    } catch (error) {
      console.error('Error listing customers:', error);
      throw new Error(error);
    }
  },

  retrievePaymentMethod: async (params) => {
    const { paymentMethodId } = params;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentMethodId);

      if (paymentIntent.status === 'requires_confirmation') {
        await stripe.paymentIntents.confirm(paymentMethodId);

      }

      return paymentIntent;

    } catch (error) {
      console.error('Error retrieving payment method:', error);
      throw new Error(error);
    }
  },

  capturePaymentIntent: async (params) => {
    const { paymentIntentId } = params;
    try {
      const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId, {
        expand: ['payment_method']
      });
      return capturedPayment;
    } catch (error) {
      console.error('Error capturing payment intent:', error);
      throw new Error(error);
    }
  },

  createCoupon: async (params) => {
    const { discountData } = params;
    try {
      const coupondata = {
        id: discountData?.discountCode,
        name: discountData?.discountCode,
        duration: 'forever', // or 'repeating' / 'forever'
        max_redemptions: discountData.maxTotalUsage,
        currency: 'usd', // or the currency you are using
        redeem_by: Math.floor(new Date(discountData.endDate).getTime() / 1000), // Unix timestamp
      }
      if (discountData.discountType === 'Percentage') {
        coupondata.percent_off = discountData.percentage;
      } else {
        coupondata.amount_off = discountData.maxDiscount;
      }
      const coupon = await stripe.coupons.create(coupondata);
      return coupon;
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw new Error(error);
    }
  },
  verifyCoupon: async (params) => {
    const { couponCode } = params;
    try {
      const coupon = await stripe.coupons.retrieve(couponCode);
      console.log(coupon, "coupons list from stripe");
      const now = Math.floor(Date.now() / 1000);
      if (coupon.redeem_by && now > coupon.redeem_by) {
        throw new Error('Coupon has expired.');
      }

      if (coupon.max_redemptions && coupon.times_redeemed >= coupon.max_redemptions) {
        throw new Error('Coupon usage limit reached.');
      }

      // Coupon is valid
      console.log('Coupon verified:', coupon);
      return coupon;
    } catch (err) {
      console.log(err,"these are error")
      throw new Error(err?.message);
    }
  }
};
