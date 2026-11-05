import { byId, html, setHtml } from "../../core/dom.js";
import { money, formatDate, safeHttpUrl } from "../../core/format.js";
import { adminApi, setMessage, statsChanged, downloadCsv, csvCell } from "./common.js";

const PAGE_SIZE = 10;
const EXPORT_SIZE = 1000;

let orders = [];
let page = 1;
let pages = 1;

function filterParams() {
  const params = new URLSearchParams();
  const add = (key, id) => {
    const value = byId(id).value.trim();
    if (value) params.set(key, value);
  };
  add("q", "orderSearch");
  add("status", "statusFilter");
  add("from", "dateFrom");
  add("to", "dateTo");
  return params;
}

function statusClass(status) {
  if (status === "Test başarılı" || status === "Tamamlandı") return "good";
  if (status === "Test başarısız" || status === "İptal edildi") return "bad";
  if (status === "Ödeme bekleniyor") return "wait";
  return "";
}

export async function loadOrders() {
  const params = filterParams();
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const result = await adminApi(`/api/admin/orders?${params}`);
  orders = result.orders;
  pages = result.pages;
  page = Math.min(page, pages);

  byId("orderCount").textContent = `${result.total} sipariş bulundu`;
  byId("pageInfo").textContent = `Sayfa ${result.page} / ${pages}`;
  byId("prevPageBtn").disabled = page <= 1;
  byId("nextPageBtn").disabled = page >= pages;

  renderTable();
}

function renderTable() {
  const target = byId("ordersTable");
  if (!orders.length) {
    setHtml(target, html`<p class="muted">Bu filtrelerle eşleşen sipariş bulunamadı.</p>`);
    return;
  }

  setHtml(
    target,
    html`
      <table>
        <thead>
          <tr><th>Sipariş</th><th>Müşteri</th><th>Ürünler</th><th>Tutar</th><th>Durum</th><th>İşlemler</th></tr>
        </thead>
        <tbody>
          ${orders.map(
            (o) => html`
              <tr>
                <td><strong>#${o.id}</strong><div class="muted">${formatDate(o.created_at)}</div></td>
                <td>${o.customer_name}<div class="muted">${o.email}</div></td>
                <td class="order-items">
                  ${o.items?.length
                    ? o.items.map((item) => html`<div>${item.name} × ${item.quantity}</div>`)
                    : "Ürün bilgisi yok"}
                </td>
                <td><strong>${money(o.total)}</strong></td>
                <td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td>
                <td>
                  <div class="actions">
                    <button class="secondary" data-detail="${o.id}" type="button">Detay</button>
                    ${o.allowed_statuses.length
                      ? html`
                          <select class="status-select" aria-label="Sipariş ${o.id} durumu" data-order-status="${o.id}">
                            ${o.allowed_statuses.map((s) => html`<option value="${s}">${s}</option>`)}
                          </select>
                          <button class="secondary" data-save-status="${o.id}" type="button">Kaydet</button>`
                      : html`<span class="muted">Son durum</span>`}
                  </div>
                </td>
              </tr>`
          )}
        </tbody>
      </table>`
  );

  target.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => showDetails(button.dataset.detail));
  });
  target.querySelectorAll("[data-save-status]").forEach((button) => {
    button.addEventListener("click", () => saveStatus(button));
  });
}

async function saveStatus(button) {
  const id = button.dataset.saveStatus;
  const select = byId("ordersTable").querySelector(`[data-order-status="${id}"]`);
  button.disabled = true;
  try {
    await adminApi(`/api/admin/orders/${id}/status`, { method: "PATCH", body: { status: select.value } });
    setMessage("ordersMessage", `#${id} siparişinin durumu güncellendi.`, "success");
    await loadOrders();
    statsChanged();
  } catch (error) {
    setMessage("ordersMessage", error.message, "error");
    button.disabled = false;
  }
}

function showDetails(id) {
  const o = orders.find((order) => String(order.id) === String(id));
  if (!o) return;
  const trackingUrl = safeHttpUrl(o.tracking_url);
  const card = (label, value) => html`<div class="detail-card"><span>${label}</span><strong>${value}</strong></div>`;

  byId("dialogTitle").textContent = `Sipariş #${o.id}`;
  setHtml(
    byId("orderDetails"),
    html`
      <div class="detail-grid">
        ${card("Müşteri", o.customer_name)}
        ${card("Tarih", formatDate(o.created_at))}
        ${card("E-posta", o.email)}
        ${card("Telefon", o.phone)}
        ${card("Adres", o.address)}
        ${card("Durum", o.status)}
      </div>
      <table class="detail-items">
        <thead><tr><th>Ürün</th><th>Adet</th><th>Birim fiyat</th><th>Ara toplam</th></tr></thead>
        <tbody>
          ${(o.items || []).map(
            (i) => html`
              <tr>
                <td>${i.name}</td>
                <td>${i.quantity}</td>
                <td>${money(i.unit_price)}</td>
                <td>${money(Number(i.unit_price) * Number(i.quantity))}</td>
              </tr>`
          )}
        </tbody>
      </table>
      <div class="detail-total"><span>Sipariş toplamı</span><span>${money(o.total)}</span></div>
      ${o.status.startsWith("Test ")
        ? html`<p class="muted">Bu sipariş test ödeme akışından geçmiştir; gerçek ödeme alındığı anlamına gelmez.</p>`
        : ""}
      <h3 class="shipping-title">Kargo takip bilgileri</h3>
      ${trackingUrl
        ? html`<p><a class="tracking-link" href="${trackingUrl}" target="_blank" rel="noopener noreferrer">Kargo takip sayfasını aç</a></p>`
        : ""}
      <form id="shippingForm" class="shipping-form">
        <label>Kargo firması
          <input id="shippingCompany" maxlength="100" value="${o.shipping_company || ""}" placeholder="Örn. Yurtiçi Kargo">
        </label>
        <label>Takip numarası
          <input id="trackingNumber" maxlength="100" value="${o.tracking_number || ""}" placeholder="Kargo takip numarası">
        </label>
        <label class="wide">Takip bağlantısı (isteğe bağlı)
          <input id="trackingUrl" type="url" maxlength="500" value="${o.tracking_url || ""}" placeholder="https://...">
        </label>
        <div class="form-actions wide">
          <button id="saveShippingBtn" type="submit">Kargo bilgilerini kaydet</button>
          <p id="shippingMessage" class="message" role="status"></p>
        </div>
      </form>`
  );

  byId("shippingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = byId("saveShippingBtn");
    button.disabled = true;
    setMessage("shippingMessage", "Kargo bilgileri kaydediliyor…");
    try {
      const { order } = await adminApi(`/api/admin/orders/${id}/shipping`, {
        method: "PATCH",
        body: {
          shipping_company: byId("shippingCompany").value.trim(),
          tracking_number: byId("trackingNumber").value.trim(),
          tracking_url: byId("trackingUrl").value.trim()
        }
      });
      Object.assign(o, order);
      showDetails(id);
      setMessage("shippingMessage", "Kargo bilgileri kaydedildi.", "success");
    } catch (error) {
      setMessage("shippingMessage", error.message, "error");
      button.disabled = false;
    }
  });

  if (!byId("orderDialog").open) byId("orderDialog").showModal();
}

function reloadFromFirstPage() {
  page = 1;
  loadOrders().catch((error) => setMessage("ordersMessage", error.message, "error"));
}

let searchTimer;
byId("orderSearch").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(reloadFromFirstPage, 300);
});
for (const id of ["statusFilter", "dateFrom", "dateTo"]) {
  byId(id).addEventListener("change", reloadFromFirstPage);
}

byId("clearFiltersBtn").addEventListener("click", () => {
  for (const id of ["orderSearch", "statusFilter", "dateFrom", "dateTo"]) byId(id).value = "";
  reloadFromFirstPage();
});

const goTo = (next) => {
  page = next;
  loadOrders().catch((error) => setMessage("ordersMessage", error.message, "error"));
};
byId("prevPageBtn").addEventListener("click", () => page > 1 && goTo(page - 1));
byId("nextPageBtn").addEventListener("click", () => page < pages && goTo(page + 1));

byId("closeDialogBtn").addEventListener("click", () => byId("orderDialog").close());
byId("orderDialog").addEventListener("click", (event) => {
  if (event.target === byId("orderDialog")) byId("orderDialog").close();
});

byId("refreshOrdersBtn").addEventListener("click", async () => {
  const button = byId("refreshOrdersBtn");
  button.disabled = true;
  try {
    await loadOrders();
    statsChanged();
    setMessage("ordersMessage", "Siparişler yenilendi.", "success");
  } catch (error) {
    setMessage("ordersMessage", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

byId("exportOrdersBtn").addEventListener("click", async () => {
  try {
    const params = filterParams();
    params.set("pageSize", String(EXPORT_SIZE));
    const { orders: rows, total } = await adminApi(`/api/admin/orders?${params}`);
    if (!rows.length) {
      setMessage("ordersMessage", "Dışa aktarılacak sipariş yok.", "error");
      return;
    }

    const header = [
      "Sipariş No", "Tarih", "Müşteri", "E-posta", "Telefon", "Adres", "Ürünler",
      "Tutar (TRY)", "Durum", "Kargo Firması", "Kargo Takip No", "Kargo Takip Bağlantısı"
    ];
    const lines = rows.map((o) => [
      o.id,
      formatDate(o.created_at),
      o.customer_name,
      o.email,
      o.phone,
      o.address,
      (o.items || []).map((i) => `${i.name} x ${i.quantity}`).join("; "),
      Number(o.total).toFixed(2),
      o.status,
      o.shipping_company,
      o.tracking_number,
      o.tracking_url
    ]);
    const csv = [header, ...lines].map((row) => row.map(csvCell).join(";")).join("\r\n");
    downloadCsv(`siparisler-${new Date().toISOString().slice(0, 10)}.csv`, csv);

    const note = total > rows.length ? ` (toplam ${total} siparişin ilk ${rows.length} tanesi)` : "";
    setMessage("ordersMessage", `${rows.length} sipariş CSV olarak dışa aktarıldı${note}.`, "success");
  } catch (error) {
    setMessage("ordersMessage", error.message, "error");
  }
});
