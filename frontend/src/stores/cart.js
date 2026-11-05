import { defineStore } from "pinia";
import { api } from "../lib/api";

/**
 * Sepet.
 *
 * Sepet SUNUCUDA durur — kayıtsız kullanıcı için de. Tarayıcıda yalnızca
 * sepetin kimliğini taşıyan HttpOnly çerez bulunur. Böylece:
 *   - sepet içeriği istemciden değiştirilemez,
 *   - fiyatlar her görüntülemede güncel üründen okunur,
 *   - kullanıcı giriş yaptığında sepet hesabına taşınır ve kaybolmaz.
 */
export const useCartStore = defineStore("cart", {
  state: () => ({
    items: [],
    itemCount: 0,
    subtotal: null,
    hasIssues: false,
    canCheckout: false,
    loading: false,
    loaded: false
  }),

  actions: {
    apply(cart) {
      this.items = cart.items ?? [];
      this.itemCount = cart.itemCount ?? 0;
      this.subtotal = cart.subtotal ?? null;
      this.hasIssues = cart.hasIssues ?? false;
      this.canCheckout = cart.canCheckout ?? false;
      this.loaded = true;
    },

    async load() {
      this.loading = true;
      try {
        this.apply(await api.get("/cart"));
      } finally {
        this.loading = false;
      }
    },

    async add(productId, quantity = 1) {
      this.apply(await api.post("/cart/items", { productId, quantity }));
    },

    async setQuantity(productId, quantity) {
      this.apply(await api.put(`/cart/items/${productId}`, { quantity }));
    },

    async remove(productId) {
      this.apply(await api.delete(`/cart/items/${productId}`));
    },

    async clear() {
      this.apply(await api.delete("/cart"));
    },

    /** Sipariş sonrası ya da giriş sonrası sepeti yeniden oku. */
    reset() {
      this.items = [];
      this.itemCount = 0;
      this.subtotal = null;
      this.loaded = false;
    }
  }
});
