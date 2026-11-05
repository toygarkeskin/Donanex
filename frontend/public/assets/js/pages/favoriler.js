import "../components/navbar.js";
import { api } from "../core/api.js";
import { byId } from "../core/dom.js";
import { getFavorites } from "../core/favorites.js";
import { createProductCard, bindAddedNotice } from "../components/product-card.js";

const list = byId("favoriListesi");
const empty = byId("favoriBos");
const suggestions = byId("favoriOneri");
const notifyAdded = bindAddedNotice();

async function render() {
  const ids = getFavorites();
  const [favorites, all] = await Promise.all([
    ids.length ? api(`/api/products?ids=${ids.join(",")}`) : { products: [] },
    api("/api/products")
  ]);

  empty.hidden = favorites.products.length > 0;
  list.replaceChildren(
    ...favorites.products.map((product) =>
      createProductCard(product, { onAdded: notifyAdded, onFavoriteChange: render })
    )
  );

  const others = all.products.filter((product) => !ids.includes(Number(product.id))).slice(0, 4);
  suggestions.replaceChildren(
    ...others.map((product) => createProductCard(product, { onAdded: notifyAdded, onFavoriteChange: render }))
  );
}

render().catch((error) => {
  empty.hidden = false;
  empty.textContent = error.message;
});
