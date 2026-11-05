"use strict";

const rateLimit = require("express-rate-limit");

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const passThrough = (_req, _res, next) => next();

function createRateLimiters({ enabled = true } = {}) {
  const limiter = (limit, error, options = {}) =>
    enabled
      ? rateLimit({
          windowMs: FIFTEEN_MINUTES,
          limit,
          standardHeaders: "draft-8",
          legacyHeaders: false,
          message: { success: false, message: error },
          ...options
        })
      : passThrough;

  const TRY_LATER = "Lütfen daha sonra tekrar deneyin.";
  const failedOnly = { skipSuccessfulRequests: true };

  return {
    api: limiter(600, `Çok fazla istek gönderildi. ${TRY_LATER}`),
    // Her form kendi sayacını kullanır; başarılı girişler sayılmaz.
    adminLogin: limiter(5, `Çok fazla hatalı giriş. ${TRY_LATER}`, failedOnly),
    customerLogin: limiter(10, `Çok fazla hatalı giriş. ${TRY_LATER}`, failedOnly),
    passwordChange: limiter(10, `Çok fazla deneme. ${TRY_LATER}`, failedOnly),
    passwordReset: limiter(5, `Çok fazla parola sıfırlama isteği. ${TRY_LATER}`),
    tracking: limiter(30, `Çok fazla takip denemesi. ${TRY_LATER}`),
    registration: limiter(5, `Çok fazla kayıt denemesi. ${TRY_LATER}`),
    support: limiter(5, `Çok fazla destek talebi gönderdiniz. ${TRY_LATER}`),
    // Stok ayırma suistimalini (sahte siparişlerle stoğu kilitleme) sınırlar.
    orders: limiter(10, `Çok fazla sipariş denemesi. ${TRY_LATER}`)
  };
}

module.exports = { createRateLimiters };
