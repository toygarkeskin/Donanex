"use strict";

import type { Logger } from "../../application/shared/contracts";

/**
 * Yapılandırılmış günlük. Olaylar CLEF biçiminde toplanır ve Seq'e gönderilir.
 *
 * Mesajlar şablonludur: "Sipariş {OrderNumber} oluşturuldu" — Seq'te
 * OrderNumber'a göre arama ve gruplama yapılabilir. Düz metin birleştirme
 * kullanılsaydı bu mümkün olmazdı.
 *
 * Gönderim toplu ve asenkrondur; Seq erişilemezse olaylar konsola düşer ve
 * uygulama etkilenmez.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const CLEF_LEVELS: Record<LogLevel, string> = {
  debug: "Debug",
  info: "Information",
  warn: "Warning",
  error: "Error"
};

type Fields = Record<string, unknown>;

export interface SeqLoggerOptions {
  readonly url?: string | null;
  readonly apiKey?: string;
  readonly level?: LogLevel;
  readonly service?: string;
  readonly batchSize?: number;
  readonly flushMs?: number;
}

export class SeqLogger implements Logger {
  private readonly url: string | null;
  private readonly apiKey: string;
  private readonly threshold: number;
  private readonly service: string;
  private readonly batchSize: number;
  private buffer: Fields[] = [];
  private context: Fields = {};
  private timer: NodeJS.Timeout | undefined;

  constructor({
    url,
    apiKey = "",
    level = "info",
    service = "api",
    batchSize = 50,
    flushMs = 2000
  }: SeqLoggerOptions = {}) {
    this.url = url ? `${url.replace(/\/+$/, "")}/ingest/clef` : null;
    this.apiKey = apiKey;
    this.threshold = LEVELS[level] ?? LEVELS.info;
    this.service = service;
    this.batchSize = batchSize;

    if (this.url) {
      this.timer = setInterval(() => this.flush(), flushMs);
      this.timer.unref();
    }
  }

  /** Alt bileşenler için sabit alanlar taşıyan türev günlükçü. */
  child(context: Fields): SeqLogger {
    const child: SeqLogger = Object.create(this);
    child.context = { ...this.context, ...context };
    return child;
  }

  write(level: LogLevel, template: string, properties: Fields = {}): void {
    if (LEVELS[level] < this.threshold) return;

    const event: Fields = {
      "@t": new Date().toISOString(),
      "@mt": template,
      ...(level === "info" ? {} : { "@l": CLEF_LEVELS[level] }),
      Service: this.service,
      ...this.context,
      ...properties
    };

    if (!this.url) {
      // Seq yapılandırılmadıysa okunabilir biçimde konsola yaz.
      const text = template.replace(/\{(\w+)\}/g, (match, key: string) =>
        event[key] === undefined ? match : String(event[key])
      );
      console[level === "debug" ? "log" : level](`[${level}] ${text}`);
      return;
    }

    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) this.flush();
  }

  debug(template: string, properties?: Fields): void {
    this.write("debug", template, properties);
  }
  info(template: string, properties?: Fields): void {
    this.write("info", template, properties);
  }
  warn(template: string, properties?: Fields): void {
    this.write("warn", template, properties);
  }
  error(template: string, properties?: Fields): void {
    this.write("error", template, properties);
  }

  async flush(): Promise<void> {
    if (!this.url || !this.buffer.length) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    const body = batch.map((event) => JSON.stringify(event)).join("\n");

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.serilog.clef",
          ...(this.apiKey ? { "X-Seq-ApiKey": this.apiKey } : {})
        },
        body,
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      // Günlük sunucusu erişilemiyorsa olaylar kaybolmasın: konsola düşsün.
      const mesaj = error instanceof Error ? error.message : String(error);
      console.error(`[seq] ${batch.length} olay gönderilemedi (${mesaj})`);
      for (const event of batch) console.log(JSON.stringify(event));
    }
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
