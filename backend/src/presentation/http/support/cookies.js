"use strict";

const ADMIN_COOKIE = "admin_session";
const CUSTOMER_COOKIE = "customer_session";

function parseCookies(req) {
  const result = Object.create(null);
  for (const item of (req.headers.cookie || "").split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    const key = item.slice(0, index).trim();
    try {
      result[key] = decodeURIComponent(item.slice(index + 1).trim());
    } catch {
      /* bozuk çerez yok sayılır */
    }
  }
  return result;
}

/** maxAgeSeconds null ise tarayıcı kapanınca silinen oturum çerezi olur. */
function sessionCookie(name, value, maxAgeSeconds, secure) {
  const age = maxAgeSeconds === null ? "" : `; Max-Age=${maxAgeSeconds}`;
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/${age}${secure ? "; Secure" : ""}`;
}

function clearCookie(name, secure) {
  return sessionCookie(name, "", 0, secure);
}

module.exports = { ADMIN_COOKIE, CUSTOMER_COOKIE, parseCookies, sessionCookie, clearCookie };
