"use strict";

import crypto from "node:crypto";
import type { IdGenerator } from "../../application/shared/contracts";

/** Kimlik üretimi de port arkasındadır; testlerde öngörülebilir kılınabilir. */
export class UuidGenerator implements IdGenerator {
  uuid(): string {
    return crypto.randomUUID();
  }
}
