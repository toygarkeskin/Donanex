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
