import { defineStore } from "pinia";
import { api } from "../lib/api";

/**
 * Katalog kategorileri.
 *
 * Kategoriler başlıktaki gezinme şeridinde, ana sayfada ve ürün listesi
 * filtresinde kullanılıyor. Her biri ayrı ayrı istek atmasın diye tek yerde
 * tutuluyor: liste oturum boyunca değişmez, sunucu tarafında da 5 dakika
 * önbelleklenir.
 *
 * Kategori çekilemezse sayfa ÇALIŞMAYA DEVAM EDER — şerit boş görünür.
 * Gezinme kolaylığı için var, sayfanın açılması buna bağlı değil.
 */
export const useCatalogStore = defineStore("catalog", {
  state: () => ({
    categories: [],
    loaded: false,
    loading: false
  }),

  actions: {
    async load() {
      if (this.loaded || this.loading) return;
      this.loading = true;
      try {
        const response = await api.get("/categories");
        this.categories = response.items ?? [];
        this.loaded = true;
      } catch {
        /* şerit boş kalır; gezinme başka yollardan sürüyor */
      } finally {
        this.loading = false;
      }
    }
  }
});
