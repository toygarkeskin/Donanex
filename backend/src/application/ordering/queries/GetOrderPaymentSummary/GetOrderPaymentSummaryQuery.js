"use strict";

class GetOrderPaymentSummaryQuery {
  constructor(orderId, trackingCode) {
    this.orderId = orderId;
    this.trackingCode = trackingCode;
  }
}

module.exports = { GetOrderPaymentSummaryQuery };
