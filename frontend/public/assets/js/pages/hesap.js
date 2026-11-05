import { api } from "../core/api.js";
import { byId } from "../core/dom.js";

const form = byId("loginForm");
const loginTab = byId("girisSekme");
const registerTab = byId("kayitSekme");
const nameField = byId("adAlani");
const nameInput = byId("ad");
const emailInput = byId("email");
const passwordInput = byId("sifre");
const notice = byId("uyari");
const submit = byId("gonderButonu");
const rememberField = byId("oturumAlani");
const rememberInput = byId("oturum");
const forgotLink = document.querySelector(".parola");

let mode = "giris";

function showNotice(text, success = false) {
  notice.textContent = text;
  notice.classList.toggle("basarili", success);
}

function switchMode(next) {
  mode = next;
  const registering = mode === "kayit";

  nameField.hidden = !registering;
  nameInput.required = registering;
  rememberField.hidden = registering;
  forgotLink.hidden = registering;
  passwordInput.autocomplete = registering ? "new-password" : "current-password";
  submit.textContent = registering ? "KAYIT OL" : "OTURUM AÇ";
  loginTab.className = registering ? "btn btn-outline-dark w-50" : "btn btn-dark w-50";
  registerTab.className = registering ? "btn btn-dark w-50" : "btn btn-outline-dark w-50";
  showNotice("");
}

loginTab.addEventListener("click", () => switchMode("giris"));
registerTab.addEventListener("click", () => switchMode("kayit"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const registering = mode === "kayit";

  submit.disabled = true;
  showNotice("İşlem yapılıyor...");

  try {
    if (registering) {
      await api("/api/customers/register", {
        method: "POST",
        body: { name: nameInput.value.trim(), email, password }
      });
      form.reset();
      switchMode("giris");
      showNotice("Kayıt başarılı! Şimdi giriş yapabilirsin.", true);
      return;
    }

    await api("/api/customers/login", {
      method: "POST",
      body: { email, password, remember: rememberInput.checked }
    });
    showNotice("Giriş başarılı! Yönlendiriliyorsun.", true);
    window.location.href = "/anasayfa.html";
  } catch (error) {
    showNotice(error.message);
  } finally {
    submit.disabled = false;
  }
});
