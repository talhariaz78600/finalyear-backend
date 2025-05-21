const { STRIPE_SECRET_ACCESS_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_ACCESS_KEY);

module.exports = {
  createPrice: async (params) => {
    try {
      const { productId, unitAmount, currency, recurring } = params;
      const price = await stripe.prices.create({
        unit_amount: unitAmount,
        currency,
        product: productId,
        ...(recurring && { recurring })
      });
      return price;
    } catch (error) {
      console.error('Error creating price:', error);
      throw error;
    }
  },

  getPrice: async (params) => {
    try {
      const { priceId } = params;
      const price = await stripe.prices.retrieve(priceId);
      return price;
    } catch (error) {
      console.error('Error retrieving price:', error);
      throw error;
    }
  },

  getPrices: async (params) => {
    try {
      const { productId } = params;
      const prices = await stripe.prices.list({
        product: productId
      });
      return prices;
    } catch (error) {
      console.error('Error retrieving prices:', error);
      throw error;
    }
  },

  updatePrice: async (params) => {
    try {
      const { priceId, updateData } = params;
      const updatedPrice = await stripe.prices.update(priceId, updateData);
      return updatedPrice;
    } catch (error) {
      console.error('Error updating price:', error);
      throw error;
    }
  },

  createProduct: async (params) => {
    try {
      const { name, description } = params;
      const product = await stripe.products.create({
        name,
        description
      });
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  getProduct: async (params) => {
    try {
      const { productId } = params;
      const product = await stripe.products.retrieve(productId);
      return product;
    } catch (error) {
      console.error('Error retrieving product:', error);
      throw error;
    }
  },

  getProducts: async () => {
    try {
      const products = await stripe.products.list();
      return products;
    } catch (error) {
      console.error('Error retrieving products:', error);
      throw error;
    }
  },

  updateProduct: async (params) => {
    try {
      const { productId, updateData } = params;
      const updatedProduct = await stripe.products.update(productId, updateData);
      return updatedProduct;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  deleteProduct: async (params) => {
    try {
      const { productId } = params;
      const deletedProduct = await stripe.products.del(productId);
      return deletedProduct;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  archivePrice: async (params) => {
    try {
      const { priceId } = params;
      const archivedPrice = await stripe.prices.update(priceId, {
        active: false
      });
      return archivedPrice;
    } catch (error) {
      console.error('Error archiving price:', error);
      throw error;
    }
  }
};
