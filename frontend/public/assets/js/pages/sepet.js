import "../components/navbar.js";
import { api } from "../core/api.js";
import { byId, html, setHtml } from "../core/dom.js";
import { money } from "../core/format.js";
import { getCart, setQuantity, removeFromCart, clearCart } from "../core/cart.js";

const list = byId("sepetListesi");
const confirmBox = byId("silmeKutusu");
let pendingRemovalId = null;

function renderEmpty() {
  setHtml(
    list,
    html`
      <div class="text-center py-5">
        <h2>SEPET BOŞ</h2>
        <p>Sepetinde henüz ürün yok.</p>
        <a href="/urunler.html" class="btn btn-dark">Ürünlere Git</a>
      </div>`
  );
}

async function render() {
  const cart = getCart();
  if (!cart.length) return renderEmpty();

  let products;
  try {
    ({ products } = await api(`/api/products?ids=${cart.map((line) => line.id).join(",")}`));
  } catch (error) {
    list.textContent = error.message;
    return;
  }

  // Satıştan kalkan ürünler sepetten düşer, kullanıcı bilgilendirilir.
  const byId_ = new Map(products.map((product) => [Number(product.id), product]));
  const missing = cart.filter((line) => !byId_.has(line.id));
  missing.forEach((line) => removeFromCart(line.id));

  const lines = getCart().map((line) => ({ ...line, product: byId_.get(line.id) }));
  if (!lines.length) return renderEmpty();

  const total = lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const overStock = lines.some((line) => line.quantity > Number(line.product.stock));

  setHtml(
    list,
    html`
      ${missing.length ? html`<div class="alert alert-warning">Satışta olmayan ${missing.length} ürün sepetinden çıkarıldı.</div>` : ""}
      <div class="row">
        <div class="col-md-8">
          ${lines.map(
            ({ id, quantity, product }) => html`
              <div class="card mb-3 shadow-sm">
                <div class="card-body d-flex justify-content-between align-items-center gap-3 flex-wrap">
                  <div>
                    <h4 class="urun-baslik">${product.name}</h4>
                    <p class="mb-0 fiyat">${money(product.price)}</p>
                    ${quantity > Number(product.stock)
                      ? html`<p class="mb-0 text-danger small">Stokta yalnızca ${product.stock} adet var.</p>`
                      : ""}
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <div class="btn-group" role="group" aria-label="Adet">
                      <button type="button" class="btn btn-outline-dark" data-azalt="${id}" aria-label="Azalt">−</button>
                      <span class="btn btn-outline-dark disabled sepet-adet">${quantity}</span>
                      <button type="button" class="btn btn-outline-dark" data-artir="${id}" aria-label="Artır">+</button>
                    </div>
                    <button type="button" class="btn btn-danger" data-sil="${id}">
                      <i class="bi bi-trash"></i> Sil
                    </button>
                  </div>
                </div>
              </div>`
          )}
        </div>
        <div class="col-md-4">
          <div class="card shadow-sm">
            <div class="card-body">
              <h3>Sipariş Özeti</h3>
              <hr>
              <h4 class="fiyat">Toplam: ${money(total)}</h4>
              <a id="satinAl" href="/satinalma.html" class="btn btn-success w-100 mt-3${overStock ? " disabled" : ""}">Satın Al</a>
              <button id="sepetiTemizle" type="button" class="btn btn-outline-danger w-100 mt-2">Sepeti Temizle</button>
            </div>
          </div>
        </div>
      </div>`
  );

  const quantityOf = (id) => getCart().find((line) => line.id === id)?.quantity || 1;
  list.querySelectorAll("[data-azalt]").forEach((button) => {
    const id = Number(button.dataset.azalt);
    button.disabled = quantityOf(id) <= 1;
    button.addEventListener("click", () => {
      setQuantity(id, quantityOf(id) - 1);
      render();
    });
  });
  list.querySelectorAll("[data-artir]").forEach((button) => {
    const id = Number(button.dataset.artir);
    button.disabled = quantityOf(id) >= Number(byId_.get(id).stock);
    button.addEventListener("click", () => {
      setQuantity(id, quantityOf(id) + 1);
      render();
    });
  });
  list.querySelectorAll("[data-sil]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingRemovalId = Number(button.dataset.sil);
      byId("silinecekUrun").textContent = byId_.get(pendingRemovalId).name;
      confirmBox.classList.add("acik");
    });
  });
  byId("sepetiTemizle").addEventListener("click", () => {
    clearCart();
    render();
  });
}

byId("silmeOnayla").addEventListener("click", () => {
  removeFromCart(pendingRemovalId);
  confirmBox.classList.remove("acik");
  render();
});
byId("silmeKapat").addEventListener("click", () => confirmBox.classList.remove("acik"));

render();
