"use strict";

const crypto = require("crypto");

/** Kimlik üretimi de port arkasındadır; testlerde öngörülebilir kılınabilir. */
class UuidGenerator {
  uuid() {
    return crypto.randomUUID();
  }
}

module.exports = { UuidGenerator };
