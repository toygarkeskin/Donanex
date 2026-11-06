"use strict";

import { ValidationError } from "../shared/errors";
import { optionalText } from "../shared/guards";

export const CARRIERS = Object.freeze([
  "Yurtiçi Kargo",
  "Aras Kargo",
  "MNG Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS",
  "Diğer"
] as const);

export interface ShippingInput {
  carrier?: unknown;
  trackingNumber?: unknown;
  trackingUrl?: unknown;
}

export interface Shipping {
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly trackingUrl: string | null;
}

/** Kargo bilgisi değer nesnesi. Boş alanlar null olarak saklanır. */
export function createShipping(input?: ShippingInput | null): Shipping {
  const data = input ?? {};
  const trackingUrl = optionalText(data.trackingUrl, "Takip bağlantısı", 500);

  if (trackingUrl) {
    // Yalnızca http/https: "javascript:" gibi bir şema mağaza panelinden
    // girilip müşteriye tıklatılabilirdi.
    let protocol: string | null = null;
    try {
      protocol = new URL(trackingUrl).protocol;
    } catch {
      /* aşağıda reddedilir */
    }
    if (protocol === null || !["http:", "https:"].includes(protocol)) {
      throw new ValidationError("Takip bağlantısı http:// veya https:// ile başlamalı.");
    }
  }

  return Object.freeze({
    carrier: optionalText(data.carrier, "Kargo firması", 100),
    trackingNumber: optionalText(data.trackingNumber, "Takip numarası", 100),
    trackingUrl
  });
}
