"use strict";

class RecordTestPaymentCommand {
  constructor(orderId, trackingCode, successful) {
    this.orderId = orderId;
    this.trackingCode = trackingCode;
    this.successful = successful;
  }
}

module.exports = { RecordTestPaymentCommand };
