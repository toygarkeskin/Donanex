"use strict";

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
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CLEF_LEVELS = { debug: "Debug", info: "Information", warn: "Warning", error: "Error" };

class SeqLogger {
  constructor({ url, apiKey = "", level = "info", service = "api", batchSize = 50, flushMs = 2000 } = {}) {
    this.url = url ? `${url.replace(/\/+$/, "")}/ingest/clef` : null;
    this.apiKey = apiKey;
    this.threshold = LEVELS[level] ?? LEVELS.info;
    this.service = service;
    this.batchSize = batchSize;
    this.buffer = [];
    this.context = {};

    if (this.url) {
      this.timer = setInterval(() => this.flush(), flushMs);
      this.timer.unref();
    }
  }

  /** Alt bileşenler için sabit alanlar taşıyan türev günlükçü. */
  child(context) {
    const child = Object.create(this);
    child.context = { ...this.context, ...context };
    return child;
  }

  write(level, template, properties = {}) {
    if (LEVELS[level] < this.threshold) return;

    const event = {
      "@t": new Date().toISOString(),
      "@mt": template,
      ...(level === "info" ? {} : { "@l": CLEF_LEVELS[level] }),
      Service: this.service,
      ...this.context,
      ...properties
    };

    if (!this.url) {
      // Seq yapılandırılmadıysa okunabilir biçimde konsola yaz.
      const text = template.replace(/\{(\w+)\}/g, (match, key) =>
        event[key] === undefined ? match : String(event[key])
      );
      console[level === "debug" ? "log" : level](`[${level}] ${text}`);
      return;
    }

    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) this.flush();
  }

  debug(template, properties) {
    this.write("debug", template, properties);
  }
  info(template, properties) {
    this.write("info", template, properties);
  }
  warn(template, properties) {
    this.write("warn", template, properties);
  }
  error(template, properties) {
    this.write("error", template, properties);
  }

  async flush() {
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
      console.error(`[seq] ${batch.length} olay gönderilemedi (${error.message})`);
      for (const event of batch) console.log(JSON.stringify(event));
    }
  }

  async close() {
    clearInterval(this.timer);
    await this.flush();
  }
}

module.exports = { SeqLogger };
