import "../components/navbar.js";
import { api } from "../core/api.js";
import { byId, html, setHtml, showMessage } from "../core/dom.js";
import { money, formatDate, safeHttpUrl } from "../core/format.js";

const orders = byId("siparisler");

async function loadAccount() {
  const { customer } = await api("/api/customers/session");
  if (!customer) {
    window.location.href = "/hesap.html";
    return false;
  }
  byId("adSoyad").value = customer.name || "";
  byId("email").textContent = customer.email || "-";
  byId("adresAd").value = customer.name || "";
  return true;
}

async function loadAddress() {
  const { address } = await api("/api/customers/address");
  if (address.fullName) byId("adresAd").value = address.fullName;
  byId("adresTelefon").value = address.phone || "";
  byId("adresMetni").value = address.address || "";
}

function orderTemplate(order) {
  const trackingUrl = safeHttpUrl(order.trackingUrl);
  return html`
    <article class="siparis-karti">
      <div class="siparis-ust">
        <div>
          <div class="siparis-numara">Sipariş #${order.id}</div>
          <div class="siparis-tarih">${formatDate(order.createdAt)}</div>
        </div>
        <span class="siparis-durum">${order.status || "Durum belirtilmemiş"}</span>
      </div>
      <div class="siparis-urunler">
        ${(order.items || []).map(
          (item) => html`
            <div class="siparis-urun">
              <span>${item.name} × ${item.quantity}</span>
              <strong class="fiyat">${money(Number(item.unitPrice) * Number(item.quantity))}</strong>
            </div>`
        )}
      </div>
      ${order.shippingCompany || order.trackingNumber
        ? html`<p class="mb-2 small">
            <i class="bi bi-truck"></i> ${order.shippingCompany || "Kargo"} ${order.trackingNumber || ""}
            ${trackingUrl ? html` · <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer">Takip et</a>` : ""}
          </p>`
        : ""}
      <div class="siparis-alt">
        <span>${order.address ? `Teslimat: ${order.address}` : "Teslimat adresi"}</span>
        <span class="siparis-toplam">${money(order.total)}</span>
      </div>
      ${order.canCancel
        ? html`<button type="button" class="btn btn-outline-danger btn-sm mt-2" data-iptal="${order.id}">Siparişi iptal et</button>`
        : ""}
    </article>`;
}

async function loadOrders() {
  try {
    const { orders: list } = await api("/api/customers/orders");
    if (!list.length) {
      setHtml(orders, html`<div class="bos-siparis">Henüz hesabına bağlı bir sipariş bulunmuyor.</div>`);
      return;
    }
    setHtml(orders, html`${list.map(orderTemplate)}`);
    orders.querySelectorAll("[data-iptal]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm(`#${button.dataset.iptal} numaralı sipariş iptal edilsin mi?`)) return;
        button.disabled = true;
        try {
          await api(`/api/customers/orders/${button.dataset.iptal}/cancel`, { method: "POST" });
          await loadOrders();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    orders.textContent = error.message;
  }
}

/** Ortak form akışı: düğmeyi kilitle, isteği gönder, sonucu yaz. */
function bindForm(formId, buttonId, messageId, submit) {
  const button = byId(buttonId);
  const message = byId(messageId);
  byId(formId).addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    showMessage(message, "Kaydediliyor...");
    try {
      const result = await submit(event.target);
      showMessage(message, result.message, "success");
    } catch (error) {
      showMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

bindForm("profilForm", "profilKaydetBtn", "profilMesaj", () =>
  api("/api/customers/profile", { method: "PUT", body: { name: byId("adSoyad").value.trim() } })
);

bindForm("adresForm", "adresKaydetBtn", "adresMesaj", () =>
  api("/api/customers/address", {
    method: "PUT",
    body: {
      fullName: byId("adresAd").value.trim(),
      phone: byId("adresTelefon").value.trim(),
      address: byId("adresMetni").value.trim()
    }
  })
);

bindForm("sifreForm", "sifreKaydetBtn", "sifreMesaj", async (form) => {
  if (byId("yeniSifre").value !== byId("yeniSifreTekrar").value) {
    throw new Error("Yeni şifreler birbiriyle aynı değil.");
  }
  const result = await api("/api/customers/password", {
    method: "PUT",
    body: { currentPassword: byId("mevcutSifre").value, newPassword: byId("yeniSifre").value }
  });
  form.reset();
  return result;
});

byId("cikisBtn").addEventListener("click", async () => {
  await api("/api/customers/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/hesap.html";
});

(async function start() {
  try {
    if (!(await loadAccount())) return;
    byId("bilgiAlani").hidden = false;
    byId("yukleniyor").hidden = true;
    await loadAddress();
    await loadOrders();
  } catch (error) {
    byId("yukleniyor").hidden = true;
    byId("hataAlani").hidden = false;
    byId("hataAlani").textContent = error.message;
  }
})();
