import { byId, html, setHtml } from "../../core/dom.js";
import { money } from "../../core/format.js";
import { adminApi, setMessage, statsChanged, downloadCsv } from "./common.js";
import { parseProductCsv } from "./csv-import.js";

let products = [];

const form = byId("productForm");

export async function loadProducts() {
  ({ products } = await adminApi("/api/admin/products"));
  const target = byId("productsTable");

  if (!products.length) {
    setHtml(target, html`<p class="muted">Henüz ürün yok.</p>`);
    return;
  }

  setHtml(
    target,
    html`
      <table>
        <thead>
          <tr><th>ID</th><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>İşlemler</th></tr>
        </thead>
        <tbody>
          ${products.map(
            (p) => html`
              <tr>
                <td>${p.id}</td>
                <td>
                  <strong>${p.name}</strong>
                  ${p.is_active ? "" : html` <span class="status-pill bad">Satışta değil</span>`}
                  <div class="muted">${p.description}</div>
                  <div class="muted">${p.image}</div>
                </td>
                <td>${p.category}</td>
                <td>${money(p.price)}</td>
                <td><strong>${Number(p.stock) || 0}</strong> adet</td>
                <td>
                  <div class="actions">
                    <button class="secondary" data-edit="${p.id}" type="button">Düzenle</button>
                    ${p.is_active
                      ? html`<button class="danger" data-delete="${p.id}" type="button">Sil</button>`
                      : html`<button class="secondary" data-restore="${p.id}" type="button">Satışa al</button>`}
                  </div>
                </td>
              </tr>`
          )}
        </tbody>
      </table>`
  );

  target.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editProduct(Number(button.dataset.edit)));
  });
  target.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => removeProduct(Number(button.dataset.delete)));
  });
  target.querySelectorAll("[data-restore]").forEach((button) => {
    button.addEventListener("click", () => restoreProduct(Number(button.dataset.restore)));
  });
}

function openForm(title) {
  byId("productFormTitle").textContent = title;
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editProduct(id) {
  const p = products.find((item) => item.id === id);
  if (!p) return;
  byId("productId").value = p.id;
  byId("productName").value = p.name;
  byId("productCategory").value = p.category;
  byId("productPrice").value = Number(p.price);
  byId("productImage").value = p.image;
  byId("productDescription").value = p.description;
  byId("productStock").value = Number(p.stock) || 0;
  openForm("Ürünü düzenle");
}

function resetForm() {
  form.reset();
  byId("productId").value = "";
  form.hidden = true;
}

async function refresh() {
  await loadProducts();
  statsChanged();
}

async function removeProduct(id) {
  const p = products.find((item) => item.id === id);
  if (!p || !confirm(`"${p.name}" ürününü silmek istiyor musun?`)) return;
  try {
    const { message } = await adminApi(`/api/admin/products/${id}`, { method: "DELETE" });
    setMessage("productMessage", message, "success");
    await refresh();
  } catch (error) {
    setMessage("productMessage", error.message, "error");
  }
}

async function restoreProduct(id) {
  try {
    const { message } = await adminApi(`/api/admin/products/${id}/restore`, { method: "POST" });
    setMessage("productMessage", message, "success");
    await refresh();
  } catch (error) {
    setMessage("productMessage", error.message, "error");
  }
}

byId("newProductBtn").addEventListener("click", () => {
  resetForm();
  openForm("Yeni ürün");
});
byId("cancelProductBtn").addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = byId("productId").value;
  try {
    const { message } = await adminApi(id ? `/api/admin/products/${id}` : "/api/admin/products", {
      method: id ? "PUT" : "POST",
      body: {
        name: byId("productName").value.trim(),
        category: byId("productCategory").value.trim(),
        price: Number(byId("productPrice").value),
        image: byId("productImage").value.trim(),
        description: byId("productDescription").value.trim(),
        stock: Number(byId("productStock").value)
      }
    });
    setMessage("productMessage", message, "success");
    resetForm();
    await refresh();
  } catch (error) {
    setMessage("productMessage", error.message, "error");
  }
});

byId("downloadProductCsvBtn").addEventListener("click", () => {
  downloadCsv(
    "urun-sablonu.csv",
    "name,category,price,stock,image,description\nÖrnek Ürün,Elektronik,199.90,10,https://example.com/resim.jpg,Ürün açıklaması\n"
  );
});

byId("importProductsBtn").addEventListener("click", async () => {
  const button = byId("importProductsBtn");
  const input = byId("productCsvFile");
  const file = input.files?.[0];
  if (!file) {
    setMessage("bulkImportMessage", "Önce bir CSV dosyası seç.", "error");
    return;
  }

  button.disabled = true;
  setMessage("bulkImportMessage", "CSV kontrol ediliyor…");
  try {
    const rows = parseProductCsv(await file.text());
    const { message } = await adminApi("/api/admin/products/bulk", { method: "POST", body: { products: rows } });
    setMessage("bulkImportMessage", message, "success");
    input.value = "";
    await refresh();
  } catch (error) {
    setMessage("bulkImportMessage", error.message, "error");
  } finally {
    button.disabled = false;
  }
});
