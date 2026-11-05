import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

/**
 * Geliştirme sunucusu API'yi doğrudan backend'e yönlendirir (docker-compose.dev.yml
 * ile açılan 8095 portu). Üretimde aynı yönlendirmeyi nginx yapar, bu yüzden
 * uygulama her iki ortamda da "/api" ile konuşur ve adres bilmesi gerekmez.
 */
const BACKEND = process.env.DEV_API_ORIGIN || "http://127.0.0.1:8095";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: false },
      "/oauth": { target: BACKEND, changeOrigin: false },
      "/.well-known": { target: BACKEND, changeOrigin: false }
    }
  },
  build: {
    // Kaynak haritaları üretim paketine girmez.
    sourcemap: false,
    chunkSizeWarningLimit: 700
  }
});
