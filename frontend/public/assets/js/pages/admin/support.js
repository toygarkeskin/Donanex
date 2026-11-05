import { byId, html, setHtml } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";
import { adminApi, setMessage, statsChanged } from "./common.js";

const STATUSES = ["Yeni", "İnceleniyor", "Yanıtlandı", "Kapatıldı"];

const statusOptions = (current) =>
  STATUSES.map((s) => (s === current ? html`<option selected>${s}</option>` : html`<option>${s}</option>`));

const preview = (text) => (text.length > 120 ? `${text.slice(0, 120)}…` : text);

export async function loadSupportRequests() {
  const { requests } = await adminApi("/api/admin/support");
  const target = byId("supportTable");
  byId("supportCount").textContent = `${requests.length} destek talebi`;

  if (!requests.length) {
    setHtml(target, html`<p class="muted">Henüz destek talebi yok.</p>`);
    return;
  }

  setHtml(
    target,
    html`
      <table>
        <thead><tr><th>No</th><th>Gönderen</th><th>Mesaj</th><th>Tarih</th><th>Durum</th><th>İşlem</th></tr></thead>
        <tbody>
          ${requests.map(
            (r) => html`
              <tr>
                <td>#${r.id}</td>
                <td>
                  <strong>${r.full_name}</strong><br>
                  <span class="muted">${r.email}<br>${r.phone || "Telefon yok"}</span>
                </td>
                <td>${preview(r.message)}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                  <select class="status-select" aria-label="Talep ${r.id} durumu" data-support-status="${r.id}">
                    ${statusOptions(r.status)}
                  </select>
                </td>
                <td>
                  <div class="actions">
                    <button type="button" class="secondary" data-support-open="${r.id}">Detay / Yanıtla</button>
                    <button type="button" class="danger" data-support-delete="${r.id}">Sil</button>
                  </div>
                </td>
              </tr>`
          )}
        </tbody>
      </table>`
  );

  target.querySelectorAll("[data-support-open]").forEach((button) => {
    button.addEventListener("click", () => openRequest(button.dataset.supportOpen));
  });
  target.querySelectorAll("[data-support-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRequest(button.dataset.supportDelete));
  });
  target.querySelectorAll("[data-support-status]").forEach((select) => {
    select.addEventListener("change", () => changeStatus(select));
  });
}

async function deleteRequest(id) {
  if (!confirm(`#${id} numaralı destek talebi silinsin mi?`)) return;
  try {
    await adminApi(`/api/admin/support/${id}`, { method: "DELETE" });
    setMessage("supportMessage", "Talep silindi.", "success");
    await loadSupportRequests();
    statsChanged();
  } catch (error) {
    setMessage("supportMessage", error.message, "error");
  }
}

async function changeStatus(select) {
  const id = select.dataset.supportStatus;
  try {
    const { request } = await adminApi(`/api/admin/support/${id}`);
    await adminApi(`/api/admin/support/${id}`, {
      method: "PUT",
      body: { status: select.value, admin_response: request.admin_response || "" }
    });
    setMessage("supportMessage", "Talep durumu güncellendi.", "success");
    statsChanged();
  } catch (error) {
    setMessage("supportMessage", error.message, "error");
  }
}

async function openRequest(id) {
  try {
    const { request: r } = await adminApi(`/api/admin/support/${id}`);
    setHtml(
      byId("supportDetail"),
      html`
        <h3>Talep #${r.id} — ${r.full_name}</h3>
        <p><strong>E-posta:</strong> ${r.email} &nbsp; <strong>Telefon:</strong> ${r.phone || "—"}</p>
        <div class="detail-card"><span>Mesaj</span><strong>${r.message}</strong></div>
        <label for="supportResponse">Yönetici yanıtı</label>
        <textarea id="supportResponse" rows="5">${r.admin_response || ""}</textarea>
        <label for="supportDetailStatus">Durum</label>
        <select id="supportDetailStatus">${statusOptions(r.status)}</select>
        <div class="form-actions">
          <button id="saveSupportResponse" class="primary" type="button">Yanıtı ve durumu kaydet</button>
        </div>`
    );

    byId("saveSupportResponse").addEventListener("click", async () => {
      try {
        const { message } = await adminApi(`/api/admin/support/${id}`, {
          method: "PUT",
          body: { status: byId("supportDetailStatus").value, admin_response: byId("supportResponse").value }
        });
        setMessage("supportMessage", message, "success");
        byId("supportDialog").close();
        await loadSupportRequests();
        statsChanged();
      } catch (error) {
        setMessage("supportMessage", error.message, "error");
      }
    });
    byId("supportDialog").showModal();
  } catch (error) {
    setMessage("supportMessage", error.message, "error");
  }
}

byId("closeSupportDialogBtn").addEventListener("click", () => byId("supportDialog").close());
byId("refreshSupportBtn").addEventListener("click", () => {
  loadSupportRequests().catch((error) => setMessage("supportMessage", error.message, "error"));
});
