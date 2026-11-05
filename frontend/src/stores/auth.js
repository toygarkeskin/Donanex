import { defineStore } from "pinia";
import { api, setAccessToken, refreshAccessToken, setUnauthorizedHandler } from "../lib/api";
import { startLogin } from "../lib/oauth";

/**
 * Oturum durumu.
 *
 * Erişim jetonu yalnızca bellekte tutulur. Sayfa yenilendiğinde jeton kaybolur
 * ama HttpOnly yenileme çerezi durduğu için "sessiz giriş" ile hemen geri alınır;
 * kullanıcı tekrar parola girmez.
 */
export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    ready: false,
    restoring: false
  }),

  getters: {
    isSignedIn: (state) => Boolean(state.user),
    isSystemAdmin: (state) => state.user?.isSystemAdmin === true,
    roles: (state) => state.user?.roles ?? [],
    /** Kişinin yetkili olduğu mağazalar; panel menüsü buna göre kurulur. */
    stores: (state) => state.user?.stores ?? [],
    hasStorePanel: (state) => (state.user?.stores ?? []).length > 0,
    displayName: (state) => state.user?.fullName ?? ""
  },

  actions: {
    /** Uygulama açılışında bir kez: jetonu tazele, kullanıcıyı yükle. */
    async restore() {
      if (this.ready || this.restoring) return;
      this.restoring = true;
      try {
        const token = await refreshAccessToken();
        if (token) await this.loadUser();
      } finally {
        this.restoring = false;
        this.ready = true;
      }
    },

    async loadUser() {
      try {
        this.user = await api.get("/me");
      } catch {
        this.user = null;
      }
    },

    /** Giriş formundan dönen jeton. */
    async completeSignIn(accessToken) {
      setAccessToken(accessToken);
      await this.loadUser();
    },

    async signOut() {
      await api.post("/auth/sign-out", {}).catch(() => {});
      setAccessToken(null);
      this.user = null;
    },

    /** Oturum düşerse durumu temizle; yönlendirmeyi router halleder. */
    clear() {
      setAccessToken(null);
      this.user = null;
    },

    login(returnTo) {
      return startLogin({ returnTo });
    }
  }
});

/** 401 alındığında mağaza temizlenir; main.js bir kez bağlar. */
export function connectUnauthorizedHandler(store) {
  setUnauthorizedHandler(() => store.clear());
}
