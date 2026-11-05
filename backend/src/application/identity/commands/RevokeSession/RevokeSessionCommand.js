"use strict";

class RevokeSessionCommand {
  constructor(token, type) {
    this.token = token;
    this.type = type;
  }
}

module.exports = { RevokeSessionCommand };
