"use strict";

class TrackOrderQuery {
  constructor(orderId, trackingCode) {
    this.orderId = orderId;
    this.trackingCode = trackingCode;
  }
}

module.exports = { TrackOrderQuery };
