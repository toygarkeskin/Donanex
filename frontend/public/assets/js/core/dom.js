const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);

function render(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(value);
}

/**
 * Şablon etiketi: içine konan HER değer otomatik kaçırılır (XSS'e karşı varsayılan güvenli).
 *   setHtml(el, html`<td>${kullaniciMetni}</td>`)
 * Yalnızca başka bir html`` sonucu olduğu gibi eklenir.
 */
export function html(strings, ...values) {
  return new SafeHtml(strings.reduce((out, part, i) => out + part + (i < values.length ? render(values[i]) : ""), ""));
}

/** innerHTML'e yalnızca html`` ile üretilmiş içerik yazılabilir. */
export function setHtml(element, content) {
  if (!(content instanceof SafeHtml)) throw new TypeError("setHtml yalnızca html`` sonucu kabul eder.");
  element.innerHTML = content.value;
}

export const byId = (id) => document.getElementById(id);

export function showMessage(element, text, type = "") {
  element.textContent = text || "";
  element.classList.toggle("text-danger", type === "error");
  element.classList.toggle("text-success", type === "success");
}
