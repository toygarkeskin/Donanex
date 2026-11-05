"use strict";

const nodemailer = require("nodemailer");

/**
 * SMTP ile e-posta gönderir.
 *
 * Demo ortamında Mailpit'e bağlanır: posta GERÇEKTEN SMTP üzerinden gönderilir
 * ve web arayüzünde görünür, ama internete çıkmaz. Böylece e-posta akışları
 * (kayıt doğrulama, parola sıfırlama, sipariş bildirimi) demoda eksiksiz
 * çalışır ve kimseye istenmeyen posta gitmez.
 */
class NodemailerMailer {
  constructor(smtp, logger = console) {
    this.from = smtp.from;
    this.logger = logger;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000
    });
  }

  async send({ to, subject, text, html }) {
    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, text, html });
      this.logger.info?.("E-posta gönderildi: {Subject} -> {Recipient}", {
        Subject: subject,
        Recipient: to,
        MessageId: info.messageId
      });
      return true;
    } catch (error) {
      this.logger.error?.("E-posta gönderilemedi: {Reason}", { Reason: error.message, Recipient: to });
      return false;
    }
  }
}

/** SMTP tanımlı değilse: gönderilmiş gibi davranır, yalnızca günlüğe yazar. */
class NullMailer {
  constructor(logger = console) {
    this.logger = logger;
    this.sent = [];
  }

  async send(message) {
    this.sent.push(message);
    this.logger.warn?.("SMTP ayarlı değil, e-posta gönderilmedi: {Subject} -> {Recipient}", {
      Subject: message.subject,
      Recipient: message.to
    });
    return false;
  }
}

function createMailer(smtp, logger) {
  return smtp.host ? new NodemailerMailer(smtp, logger) : new NullMailer(logger);
}

module.exports = { createMailer, NodemailerMailer, NullMailer };
