import "../components/navbar.js";
import { api } from "../core/api.js";
import { byId, html, setHtml } from "../core/dom.js";
import { createProductCard, bindAddedNotice } from "../components/product-card.js";

const list = byId("urunListesi");
const search = byId("urunArama");
const category = byId("urunKategori");
const summary = byId("urunOzet");
const notifyAdded = bindAddedNotice();

// ?kategori=Klavye,Mouse  /  ?q=rtx  bağlantıları filtreyi hazır açar.
const params = new URLSearchParams(window.location.search);
let groupedCategories = params.get("kategori") || "";
search.value = params.get("q") || "";

function syncUrl() {
  const next = new URLSearchParams();
  if (search.value.trim()) next.set("q", search.value.trim());
  if (category.value || groupedCategories) next.set("kategori", category.value || groupedCategories);
  const query = next.toString();
  history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

let requestNumber = 0;

async function loadProducts() {
  const current = ++requestNumber;
  const query = new URLSearchParams();
  if (search.value.trim()) query.set("q", search.value.trim());
  if (category.value || groupedCategories) query.set("category", category.value || groupedCategories);
  syncUrl();

  try {
    const { products } = await api(`/api/products?${query}`);
    if (current !== requestNumber) return; // Daha yeni bir arama başladı.

    summary.textContent = `${products.length} ürün listeleniyor`;
    if (!products.length) {
      setHtml(list, html`<p class="text-center w-100">Aramana uygun ürün bulunamadı.</p>`);
      return;
    }
    list.replaceChildren(...products.map((product) => createProductCard(product, { onAdded: notifyAdded })));
  } catch (error) {
    list.textContent = error.message;
  }
}

async function loadCategories() {
  try {
    const { categories } = await api("/api/product-categories");
    for (const name of categories) category.add(new Option(name, name));
    if (categories.includes(groupedCategories)) {
      category.value = groupedCategories;
      groupedCategories = "";
    }
  } catch {
    /* Filtre olmadan da liste çalışır. */
  }
}

let timer;
search.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(loadProducts, 300);
});
byId("urunFiltreForm").addEventListener("submit", (event) => {
  event.preventDefault();
  loadProducts();
});
category.addEventListener("change", () => {
  groupedCategories = "";
  loadProducts();
});
for (const link of document.querySelectorAll("[data-kategori]")) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    groupedCategories = link.dataset.kategori;
    category.value = "";
    search.value = "";
    loadProducts().then(() => list.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
}

loadCategories().then(loadProducts);
