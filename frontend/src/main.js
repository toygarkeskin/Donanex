import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useAuthStore, connectUnauthorizedHandler } from "./stores/auth";
import "./style.css";

const app = createApp(App);
app.use(createPinia());

// Jeton yenilenemediğinde oturumu temizle; router kullanıcıyı girişe yollar.
connectUnauthorizedHandler(useAuthStore());

app.use(router);
app.mount("#app");

/*
 * Service worker.
 *
 * Yükleme BİTTİKTEN SONRA kaydediliyor: kayıt, ilk açılışta indirilecek
 * dosyalarla aynı anda yarışırsa sayfanın görünmesi gecikiyor.
 *
 * Yalnızca üretim derlemesinde. Geliştirmede service worker, Vite'ın
 * anlık güncellemesinin önüne geçip eski dosya sunabiliyor ve "neden
 * değişmedi?" diye saatler kaybettiriyor.
 */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* kayıt başarısızsa site normal çalışmayı sürdürür */
    });
  });
}
