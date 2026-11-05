"use strict";

const { ValidationError } = require("../shared/errors");
const { isEmail, isPhone } = require("../shared/guards");

const SupportStatus = Object.freeze({
  NEW: "Yeni",
  IN_REVIEW: "İnceleniyor",
  ANSWERED: "Yanıtlandı",
  CLOSED: "Kapatıldı"
});

const SUPPORT_STATUSES = Object.freeze(Object.values(SupportStatus));

const text = (value) => (typeof value === "string" ? value.trim() : "");

function createSupportRequest(body) {
  const input = body || {};
  const fullName = text(input.fullName);
  const email = text(input.email);
  const phone = text(input.phone);
  const message = text(input.message);

  if (!fullName || !email || !message) {
    throw new ValidationError("Ad Soyad, e-posta ve mesaj zorunludur.");
  }
  if (fullName.length > 200 || message.length > 10000) {
    throw new ValidationError("Form alanlarından biri izin verilen uzunluğu aşıyor.");
  }
  if (!isEmail(email)) throw new ValidationError("Geçerli bir e-posta gir.");
  if (phone && !isPhone(phone)) throw new ValidationError("Geçerli bir telefon numarası gir.");

  return Object.freeze({ fullName, email, phone, message });
}

function createSupportResponse(body) {
  const input = body || {};
  const status = text(input.status) || SupportStatus.NEW;
  const response = text(input.admin_response);

  if (!SUPPORT_STATUSES.includes(status)) throw new ValidationError("Geçersiz talep durumu.");
  if (response.length > 10000) throw new ValidationError("Yanıt çok uzun.");

  return Object.freeze({ status, response });
}

module.exports = { SupportStatus, SUPPORT_STATUSES, createSupportRequest, createSupportResponse };
