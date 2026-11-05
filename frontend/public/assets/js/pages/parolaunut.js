import { api } from "../core/api.js";
import { byId } from "../core/dom.js";

const forgotView = byId("unuttumAlani");
const resetView = byId("sifirlaAlani");
const notice = byId("uyari");

const showNotice = (text, success = false) => {
  notice.textContent = text;
  notice.classList.toggle("basarili", success);
};

// Belirteç "#" sonrasında gelir (sunucuya gitmez); okununca adres çubuğundan da silinir.
const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
if (token) history.replaceState(null, "", window.location.pathname);

forgotView.hidden = Boolean(token);
resetView.hidden = !token;

byId("unuttumForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button");
  button.disabled = true;
  showNotice("Gönderiliyor...");
  try {
    const { message } = await api("/api/customers/password/forgot", {
      method: "POST",
      body: { email: byId("unuttumEmail").value.trim() }
    });
    showNotice(message, true);
  } catch (error) {
    showNotice(error.message);
  } finally {
    button.disabled = false;
  }
});

byId("sifirlaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = byId("yeniSifre").value;
  if (password !== byId("yeniSifreTekrar").value) {
    showNotice("Şifreler birbiriyle aynı değil.");
    return;
  }

  const button = event.target.querySelector("button");
  button.disabled = true;
  showNotice("Güncelleniyor...");
  try {
    const { message } = await api("/api/customers/password/reset", {
      method: "POST",
      body: { token, password }
    });
    showNotice(message, true);
    event.target.reset();
    setTimeout(() => {
      window.location.href = "/hesap.html";
    }, 1500);
  } catch (error) {
    showNotice(error.message);
    button.disabled = false;
  }
});
