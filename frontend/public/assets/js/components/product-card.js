import { html, setHtml } from "../core/dom.js";
import { money } from "../core/format.js";
import { addToCart } from "../core/cart.js";
import { isFavorite, toggleFavorite } from "../core/favorites.js";

const heart = (active) => (active ? "bi bi-heart-fill" : "bi bi-heart");

/** Ürünler ve Favoriler sayfalarının ortak kartı. Olaylar kart içinde bağlanır. */
export function createProductCard(product, { onAdded, onFavoriteChange } = {}) {
  const id = Number(product.id);
  const stock = Number(product.stock) || 0;

  const card = document.createElement("div");
  card.className = "card urun-karti";
  setHtml(
    card,
    html`
      <button type="button" class="favori-buton" aria-label="${`${product.name} favorilere ekle/çıkar`}">
        <i class="${heart(isFavorite(id))}"></i>
      </button>
      <img class="kutu-img" src="${product.image}" alt="${product.name}" loading="lazy">
      <strong class="urun-baslik">${product.description}</strong>
      <h1 class="fiyat">${money(product.price)}</h1>
      <p class="${stock > 0 ? "stok-bilgisi" : "stok-bilgisi stok-yok"}">
        ${stock > 0 ? `Stokta: ${stock} adet` : "Stokta yok"}
      </p>
      <button type="button" class="bg-warning text-white sepete-ekle">
        ${stock > 0 ? "Sepete Ekle" : "Stokta Yok"}
      </button>`
  );

  const addButton = card.querySelector(".sepete-ekle");
  addButton.disabled = stock <= 0;
  addButton.addEventListener("click", () => {
    addToCart(id);
    onAdded?.(product);
  });

  const favoriteButton = card.querySelector(".favori-buton");
  favoriteButton.addEventListener("click", () => {
    const active = toggleFavorite(id);
    favoriteButton.querySelector("i").className = heart(active);
    onFavoriteChange?.(product, active);
  });

  return card;
}

/** Sepete ekleme bildirimi (#bildirim kutusu olan sayfalarda). */
export function bindAddedNotice() {
  const box = document.getElementById("bildirim");
  document.getElementById("bildirimKapat").addEventListener("click", () => {
    box.classList.remove("acik");
  });
  return (product) => {
    document.getElementById("bildirimMesaji").textContent = `${product.name} sepete eklendi!`;
    box.classList.add("acik");
  };
}
