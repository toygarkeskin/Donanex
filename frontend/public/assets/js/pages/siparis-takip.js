import "../components/navbar.js";
import { api } from "../core/api.js";
import { byId, html, setHtml } from "../core/dom.js";
import { money, formatDate, safeHttpUrl } from "../core/format.js";
import { recallOrder } from "../core/order-access.js";

const form = byId("takipForm");
const message = byId("mesaj");
const result = byId("sonuc");
const submit = byId("sorgulaBtn");

const saved = recallOrder();
if (saved) {
  byId("orderId").value = saved.orderId;
  byId("trackingCode").value = saved.trackingCode;
}
const urlOrderId = new URLSearchParams(window.location.search).get("orderId");
if (urlOrderId) byId("orderId").value = urlOrderId;

const field = (label, value) =>
  html`<p class="mb-2"><strong>${label}: </strong>${value === null || value === undefined || value === "" ? "Henüz girilmedi" : value}</p>`;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Sipariş sorgulanıyor...";
  result.classList.add("d-none");
  submit.disabled = true;

  try {
    const { order } = await api("/api/order-tracking", {
      method: "POST",
      body: { orderId: byId("orderId").value.trim(), trackingCode: byId("trackingCode").value.trim() }
    });
    const trackingUrl = safeHttpUrl(order.tracking_url);

    setHtml(
      result,
      html`
        ${field("Sipariş numarası", order.id)}
        ${field("Tarih", formatDate(order.created_at))}
        ${field("Sipariş durumu", order.status)}
        ${field("Tutar", money(order.total))}
        ${field("Kargo firması", order.shipping_company)}
        ${field("Kargo takip numarası", order.tracking_number)}
        <ul class="mb-2">
          ${(order.items || []).map((item) => html`<li>${item.name} × ${item.quantity}</li>`)}
        </ul>
        ${trackingUrl
          ? html`<a class="btn btn-outline-primary align-self-start mt-2" href="${trackingUrl}" target="_blank" rel="noopener noreferrer">Kargo takibini aç</a>`
          : ""}`
    );
    result.classList.remove("d-none");
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
