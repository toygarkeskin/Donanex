"use strict";

const { ValidationError } = require("../shared/errors");

const clean = (value) => (typeof value === "string" ? value.trim() : "");

/** Kargo bilgisi değer nesnesi. Boş alanlar null olarak saklanır. */
function createShipping(body) {
  const input = body || {};
  const company = clean(input.shipping_company);
  const trackingNumber = clean(input.tracking_number);
  const trackingUrl = clean(input.tracking_url);

  if (company.length > 100 || trackingNumber.length > 100 || trackingUrl.length > 500) {
    throw new ValidationError("Kargo alanlarından biri çok uzun.");
  }

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
    company: company || null,
    trackingNumber: trackingNumber || null,
    trackingUrl: trackingUrl || null
  });
}

module.exports = { createShipping };
