"use strict";

import type { Clock } from "../../application/shared/contracts";

/** Zaman bir bağımlılıktır: testlerde sabitlenebilsin diye port arkasında durur. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Testlerde zamanı dondurmak ve elle ilerletmek için. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(date: Date | string | number) {
    this.current = new Date(date);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
