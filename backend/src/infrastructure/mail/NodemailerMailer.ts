"use strict";

import nodemailer, { type Transporter } from "nodemailer";

import type { Logger, Mailer } from "../../application/shared/contracts";

/**
 * SMTP ile e-posta gönderir.
 *
 * Demo ortamında Mailpit'e bağlanır: posta GERÇEKTEN SMTP üzerinden gönderilir
 * ve web arayüzünde görünür, ama internete çıkmaz. Böylece e-posta akışları
 * (kayıt doğrulama, parola sıfırlama, sipariş bildirimi) demoda eksiksiz
 * çalışır ve kimseye istenmeyen posta gitmez.
 */
export interface SmtpConfig {
  readonly host?: string;
  readonly port?: number;
  readonly secure?: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from?: string;
}

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
}

export class NodemailerMailer implements Mailer {
  private readonly from: string | undefined;
  private readonly logger: Partial<Logger>;
  private readonly transporter: Transporter;

  constructor(smtp: SmtpConfig, logger: Partial<Logger> = console) {
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

  /** Gönderim başarısızsa FIRLATMAZ: false döner, çağıran akışı sürdürür. */
  async send({ to, subject, text, html }: MailMessage): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, text, html });
      this.logger.info?.("E-posta gönderildi: {Subject} -> {Recipient}", {
        Subject: subject,
        Recipient: to,
        MessageId: info.messageId
      });
      return true;
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : String(error);
      this.logger.error?.("E-posta gönderilemedi: {Reason}", { Reason: mesaj, Recipient: to });
      return false;
    }
  }
}

/** SMTP tanımlı değilse: gönderilmiş gibi davranır, yalnızca günlüğe yazar. */
export class NullMailer implements Mailer {
  private readonly logger: Partial<Logger>;
  /** Testler gönderilmeye çalışılan postaları buradan okur. */
  readonly sent: MailMessage[] = [];

  constructor(logger: Partial<Logger> = console) {
    this.logger = logger;
  }

  async send(message: MailMessage): Promise<boolean> {
    this.sent.push(message);
    this.logger.warn?.("SMTP ayarlı değil, e-posta gönderilmedi: {Subject} -> {Recipient}", {
      Subject: message.subject,
      Recipient: message.to
    });
    return false;
  }
}

export function createMailer(smtp: SmtpConfig, logger?: Partial<Logger>): Mailer {
  return smtp.host ? new NodemailerMailer(smtp, logger) : new NullMailer(logger);
}
