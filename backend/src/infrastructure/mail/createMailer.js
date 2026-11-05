"use strict";

const nodemailer = require("nodemailer");

class NodemailerMailer {
  constructor(smtp) {
    this.from = smtp.from;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass }
    });
  }

  /** E-posta gönderir; hata durumunda false döner (çağıranı düşürmez). */
  async send({ to, subject, text }) {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch (error) {
      console.error("E-posta gönderilemedi:", error.message);
      return false;
    }
  }
}

/** SMTP ayarlanmamışsa kullanılır: hiçbir şey göndermez. */
class NullMailer {
  async send() {
    return false;
  }
}

function createMailer(smtp) {
  return smtp.host && smtp.user && smtp.pass ? new NodemailerMailer(smtp) : new NullMailer();
}

module.exports = { createMailer, NodemailerMailer, NullMailer };
