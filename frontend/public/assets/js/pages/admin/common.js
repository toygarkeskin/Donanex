import { api } from "../../core/api.js";
import { byId } from "../../core/dom.js";

let unauthorizedHandler = () => {};

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

/** 401 alınırsa giriş ekranına döner. Giriş isteğinin kendi 401'i hariç. */
export async function adminApi(url, options) {
  try {
    return await api(url, options);
  } catch (error) {
    if (error.status === 401 && url !== "/api/admin/login") unauthorizedHandler();
    throw error;
  }
}

export function setMessage(id, text, type = "") {
  const element = byId(id);
  element.textContent = text || "";
  element.className = `message${type ? ` ${type}` : ""}`;
}

export function statsChanged() {
  document.dispatchEvent(new CustomEvent("admin:stats-changed"));
}

export function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob(["﻿", content], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * CSV hücresi. = + - @ ile başlayan metinler Excel'de formül olarak çalışır (CSV injection);
 * müşteri girdisi olabilecekleri için başına ' eklenir.
 */
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
