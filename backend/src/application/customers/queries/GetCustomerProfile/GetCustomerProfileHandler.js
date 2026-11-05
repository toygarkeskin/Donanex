"use strict";

/** Oturumdaki müşterinin profilini döndürür (müşteri silinmişse null). */
class GetCustomerProfileHandler {
  constructor({ customerReadModel }) {
    this.readModel = customerReadModel;
  }

  handle({ customerId }) {
    return this.readModel.getProfile(customerId);
  }
}

module.exports = { GetCustomerProfileHandler };
