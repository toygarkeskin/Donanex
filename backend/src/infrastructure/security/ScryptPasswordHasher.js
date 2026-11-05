"use strict";

const crypto = require("crypto");

// OWASP önerisi. Biçim: scrypt$N$r$p$tuz$anahtar
const PARAMS = Object.freeze({ N: 2 ** 16, r: 8, p: 2 });
const KEY_LENGTH = 64;
const LEGACY_PARAMS = Object.freeze({ N: 2 ** 14, r: 8, p: 1 });
const DUMMY_SALT = "0".repeat(32);

function derive(password, salt, keyLength, { N, r, p }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, { N, r, p, maxmem: 128 * N * r * (p + 1) + 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

function parse(stored) {
  const value = String(stored);
  if (value.startsWith("scrypt$")) {
    const [, N, r, p, salt, keyHex] = value.split("$");
    return { salt, keyHex, params: { N: Number(N), r: Number(r), p: Number(p) } };
  }
  // Eski kayıtlar: "tuz:anahtar" (girişte yeni biçime yükseltilir)
  const [salt, keyHex] = value.split(":");
  return { salt, keyHex, params: LEGACY_PARAMS };
}

class ScryptPasswordHasher {
  async hash(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const key = await derive(password, salt, KEY_LENGTH, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt}$${key.toString("hex")}`;
  }

  async verify(password, storedHash) {
    const { salt, keyHex, params } = parse(storedHash);
    if (!salt || !keyHex || !/^[a-f0-9]+$/i.test(keyHex) || !Number.isInteger(params.N)) return false;

    const expected = Buffer.from(keyHex, "hex");
    const key = await derive(password, salt, expected.length, params);
    return crypto.timingSafeEqual(expected, key);
  }

  /** Kullanıcı yokken aynı süreyi harcar; yanıt süresi kayıtlı e-postaları ele vermez. */
  async verifyDummy(password) {
    await derive(password, DUMMY_SALT, KEY_LENGTH, PARAMS);
    return false;
  }

  needsRehash(storedHash) {
    const { params } = parse(storedHash);
    return params.N !== PARAMS.N || params.r !== PARAMS.r || params.p !== PARAMS.p;
  }
}

module.exports = { ScryptPasswordHasher };
