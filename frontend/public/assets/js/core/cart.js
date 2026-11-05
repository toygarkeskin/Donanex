import { readJson, writeJson } from "./storage.js";

const KEY = "sepet.v2";
const MAX_QUANTITY = 99;

const valid = (line) =>
  line && Number.isInteger(line.id) && line.id > 0 && Number.isInteger(line.quantity) && line.quantity > 0;

/** Sepette yalnızca ürün numarası ve adet tutulur; ad ve fiyat her seferinde sunucudan gelir. */
export function getCart() {
  const lines = readJson(KEY, []);
  return Array.isArray(lines) ? lines.filter(valid) : [];
}

function save(lines) {
  writeJson(KEY, lines);
  document.dispatchEvent(new CustomEvent("cart:changed"));
}

export function addToCart(id, quantity = 1) {
  const lines = getCart();
  const line = lines.find((item) => item.id === id);
  if (line) line.quantity = Math.min(MAX_QUANTITY, line.quantity + quantity);
  else lines.push({ id, quantity });
  save(lines);
}

export function setQuantity(id, quantity) {
  const lines = getCart();
  const line = lines.find((item) => item.id === id);
  if (!line) return;
  line.quantity = Math.min(MAX_QUANTITY, Math.max(1, quantity));
  save(lines);
}

export function removeFromCart(id) {
  save(getCart().filter((item) => item.id !== id));
}

export function clearCart() {
  save([]);
}

export const cartCount = () => getCart().reduce((total, line) => total + line.quantity, 0);
