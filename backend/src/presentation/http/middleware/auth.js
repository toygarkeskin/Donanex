"use strict";

const { ResolveSessionsQuery } = require("../../../application/identity");
const { ADMIN_COOKIE, CUSTOMER_COOKIE, parseCookies } = require("../support/cookies");

/** Her istekte req.admin / req.customer alanlarını doldurur (oturum yoksa null). */
function createSessionResolver({ queries }) {
  return async function resolveSessions(req, _res, next) {
    const cookies = parseCookies(req);
    req.cookies = cookies;
    const { admin, customer } = await queries.ask(
      new ResolveSessionsQuery(cookies[ADMIN_COOKIE], cookies[CUSTOMER_COOKIE])
    );
    req.admin = admin;
    req.customer = customer;
    next();
  };
}

function createAuthGuards() {
  return {
    requireAdmin(req, res, next) {
      if (!req.admin) return res.status(401).json({ success: false, message: "Yönetici girişi gerekli." });
      next();
    },
    requireCustomer(req, res, next) {
      if (!req.customer) return res.status(401).json({ success: false, message: "Lütfen giriş yapın." });
      next();
    }
  };
}

module.exports = { createSessionResolver, createAuthGuards };
