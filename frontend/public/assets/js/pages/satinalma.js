import { api } from "../core/api.js";
import { byId, html, setHtml } from "../core/dom.js";
import { money } from "../core/format.js";
import { getCart } from "../core/cart.js";
import { rememberOrder } from "../core/order-access.js";

const form = byId("siparisForm");
const summary = byId("siparisOzeti");
const message = byId("sonucMesaji");
const button = byId("siparisButonu");

async function renderSummary() {
  const cart = getCart();
  if (!cart.length) {
    summary.textContent = "Sepetiniz boş. Önce ürün ekleyin.";
    button.disabled = true;
    return;
  }

  try {
    const { products } = await api(`/api/products?ids=${cart.map((line) => line.id).join(",")}`);
    const byProduct = new Map(products.map((product) => [Number(product.id), product]));
    const lines = cart.filter((line) => byProduct.has(line.id));
    const total = lines.reduce((sum, line) => sum + Number(byProduct.get(line.id).price) * line.quantity, 0);

    setHtml(
      summary,
      html`
        <h4>Siparişinizdeki ürünler</h4>
        ${lines.map((line) => html`<p>${byProduct.get(line.id).name} × ${line.quantity}</p>`)}
        <p><strong>Toplam: <span class="fiyat">${money(total)}</span></strong></p>
        <p>Bu işlem test ödeme ekranına yönlendirir. Gerçek para çekilmez.</p>`
    );
  } catch (error) {
    summary.textContent = error.message;
  }
}

/** Giriş yapmış müşterinin kayıtlı bilgileriyle formu doldurur. */
async function prefill() {
  try {
    const { customer } = await api("/api/customers/session");
    if (!customer) return;
    form.elements.adSoyad.value = customer.name || "";
    form.elements.email.value = customer.email || "";

    const { address } = await api("/api/customers/address");
    if (address.fullName) form.elements.adSoyad.value = address.fullName;
    form.elements.telefon.value = address.phone || "";
    form.elements.adres.value = address.address || "";
  } catch {
    /* Form elle de doldurulabilir. */
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const cart = getCart();
  if (!cart.length) {
    message.textContent = "Sepetiniz boş.";
    return;
  }

  button.disabled = true;
  message.textContent = "Sipariş hazırlanıyor...";

  try {
    const { orderId, trackingCode } = await api("/api/orders", {
      method: "POST",
      body: {
        fullName: form.elements.adSoyad.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.telefon.value.trim(),
        address: form.elements.adres.value.trim(),
        items: cart.map((line) => ({ productId: line.id, quantity: line.quantity }))
      }
    });
    rememberOrder(orderId, trackingCode);
    window.location.href = `/odeme-test.html?orderId=${encodeURIComponent(orderId)}`;
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

renderSummary();
prefill();
