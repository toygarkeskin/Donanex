import { defineStore } from "pinia";

let nextId = 1;

/** Kısa bildirimler. Hata mesajları sunucudan geldiği gibi gösterilir. */
export const useToastStore = defineStore("toast", {
  state: () => ({ items: [] }),

  actions: {
    push(message, tone = "info", timeout = 4500) {
      const id = nextId++;
      this.items.push({ id, message, tone });
      setTimeout(() => this.dismiss(id), timeout);
      return id;
    },
    success(message) {
      return this.push(message, "success");
    },
    error(message) {
      return this.push(message, "error", 7000);
    },
    info(message) {
      return this.push(message, "info");
    },
    dismiss(id) {
      this.items = this.items.filter((item) => item.id !== id);
    }
  }
});
