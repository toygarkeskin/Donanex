"use strict";

const crypto = require("crypto");

/**
 * scrypt ile parola özeti. Biçim: scrypt$N$r$p$tuz$anahtar
 *
 * scrypt seçildi çünkü Node'un içinde gelir: derleme gerektiren bir bağımlılık
 * yok, bu yüzden her ortamda aynı şekilde çalışır. Parametreler OWASP'ın
 * önerdiği alt sınırın üzerindedir (N=2^16, r=8, p=2).
 */
const PARAMS = Object.freeze({ N: 2 ** 16, r: 8, p: 2 });
const KEY_LENGTH = 64;
const DUMMY_SALT = "0".repeat(32);

function derive(password, salt, keyLength, { N, r, p }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keyLength,
      { N, r, p, maxmem: 128 * N * r * (p + 1) + 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

function parse(stored) {
  const value = String(stored ?? "");
  if (!value.startsWith("scrypt$")) return null;
  const [, N, r, p, salt, keyHex] = value.split("$");
  if (!salt || !keyHex || !/^[a-f0-9]+$/i.test(keyHex)) return null;
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) return null;
  return { salt, keyHex, params };
}

class ScryptPasswordHasher {
  async hash(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const key = await derive(password, salt, KEY_LENGTH, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt}$${key.toString("hex")}`;
  }

  async verify(password, storedHash) {
    const parsed = parse(storedHash);
    if (!parsed) return false;

    const expected = Buffer.from(parsed.keyHex, "hex");
    const key = await derive(password, parsed.salt, expected.length, parsed.params);
    return expected.length === key.length && crypto.timingSafeEqual(expected, key);
  }

  /**
   * Kullanıcı yokken de aynı hesaplama yapılır. Yanıt süresi, bir e-postanın
   * kayıtlı olup olmadığını ele vermez.
   */
  async verifyDummy(password) {
    await derive(String(password ?? ""), DUMMY_SALT, KEY_LENGTH, PARAMS);
    return false;
  }

  /** Parametreler sertleştirildiğinde eski özetler girişte yükseltilsin diye. */
  needsRehash(storedHash) {
    const parsed = parse(storedHash);
    if (!parsed) return true;
    return parsed.params.N !== PARAMS.N || parsed.params.r !== PARAMS.r || parsed.params.p !== PARAMS.p;
  }
}

module.exports = { ScryptPasswordHasher };
