import { defineStore } from "pinia";

const ANAHTAR = "tema";

/*
 * Tema tercihi tarayıcıda durur, sunucuya gitmez: kişisel bir görünüm
 * ayarıdır, hesaba bağlı değildir. localStorage gizli pencerede ya da
 * site verisi engellendiğinde hata fırlatabilir; bu yüzden her erişim
 * sarmalanır ve okunamazsa sistem tercihine düşülür.
 */
function oku() {
  try {
    return localStorage.getItem(ANAHTAR);
  } catch {
    return null;
  }
}

function yaz(deger) {
  try {
    localStorage.setItem(ANAHTAR, deger);
  } catch {
    // Tercih hatırlanamaz ama tema yine de bu oturumda çalışır.
  }
}

function sistemKoyuMu() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export const useThemeStore = defineStore("theme", {
  state: () => ({
    // public/tema.js aynı mantığı açılışta çalıştırır; burada yalnızca
    // tekrarlanır ki store ile DOM aynı şeyi söylesin.
    tema: oku() ?? (sistemKoyuMu() ? "koyu" : "acik")
  }),

  getters: {
    koyuMu: (state) => state.tema === "koyu",
    etiket: (state) => (state.tema === "koyu" ? "Açık temaya geç" : "Koyu temaya geç")
  },

  actions: {
    uygula() {
      const koyu = this.tema === "koyu";
      const kok = document.documentElement;
      kok.setAttribute("data-theme", koyu ? "dark" : "light");
      kok.style.colorScheme = koyu ? "dark" : "light";
    },

    degistir() {
      this.tema = this.tema === "koyu" ? "acik" : "koyu";
      yaz(this.tema);
      this.uygula();
    }
  }
});
