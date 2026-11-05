"use strict";

class ResetPasswordCommand {
  constructor(token, newPassword) {
    this.token = token;
    this.newPassword = newPassword;
  }
}

module.exports = { ResetPasswordCommand };
