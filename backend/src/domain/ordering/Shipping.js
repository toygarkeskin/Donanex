"use strict";

const { ValidationError } = require("../shared/errors");
const { optionalText } = require("../shared/guards");

const CARRIERS = Object.freeze([
  "Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "UPS", "Diğer"
]);

/** Kargo bilgisi değer nesnesi. Boş alanlar null olarak saklanır. */
function createShipping(input) {
  const data = input || {};
  const trackingUrl = optionalText(data.trackingUrl, "Takip bağlantısı", 500);

  if (trackingUrl) {
    let protocol = null;
    try {
      protocol = new URL(trackingUrl).protocol;
    } catch {
      /* aşağıda reddedilir */
    }
    if (!["http:", "https:"].includes(protocol)) {
      throw new ValidationError("Takip bağlantısı http:// veya https:// ile başlamalı.");
    }
  }

  return Object.freeze({
    carrier: optionalText(data.carrier, "Kargo firması", 100),
    trackingNumber: optionalText(data.trackingNumber, "Takip numarası", 100),
    trackingUrl
  });
}

module.exports = { createShipping, CARRIERS };
