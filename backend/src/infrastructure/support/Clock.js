"use strict";

/** Zaman bir bağımlılıktır: testlerde sabitlenebilsin diye port arkasında durur. */
class SystemClock {
  now() {
    return new Date();
  }
}

class FixedClock {
  constructor(date) {
    this.current = new Date(date);
  }

  now() {
    return new Date(this.current);
  }

  advance(ms) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

module.exports = { SystemClock, FixedClock };
