"use strict";

class ExpireUnpaidOrdersCommand {
  constructor(olderThanMinutes) {
    this.olderThanMinutes = olderThanMinutes;
  }
}

module.exports = { ExpireUnpaidOrdersCommand };
