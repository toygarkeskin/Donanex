"use strict";

class PlaceOrderCommand {
  /**
   * @param {object} checkout  { fullName, email, phone, address, items: [{ productId, quantity }] }
   * @param {string|null} customerId  giriş yapmış müşteri varsa
   */
  constructor(checkout, customerId = null) {
    this.checkout = checkout || {};
    this.customerId = customerId;
  }
}

module.exports = { PlaceOrderCommand };
