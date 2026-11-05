import { api } from "../core/api.js";
import { byId } from "../core/dom.js";
import { money } from "../core/format.js";
import { clearCart } from "../core/cart.js";
import { recallOrder } from "../core/order-access.js";

const orderId = new URLSearchParams(window.location.search).get("orderId");
const access = recallOrder();
const trackingCode = access && access.orderId === orderId ? access.trackingCode : null;

const message = byId("mesaj");
const approve = byId("onayla");
const fail = byId("basarisiz");
const codeField = byId("gosterilenTakipKodu");
const copyButton = byId("takipKoduKopyala");

const setButtons = (enabled) => {
  approve.disabled = !enabled;
  fail.disabled = !enabled;
};

byId("siparisNo").textContent = orderId || "Geçersiz";
setButtons(false);

if (trackingCode) {
  byId("takipSiparisNo").textContent = orderId;
  codeField.value = trackingCode;
  byId("takipKoduBilgisi").classList.remove("d-none");
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(codeField.value);
    copyButton.textContent = "Kopyalandı!";
  } catch {
    codeField.select();
    copyButton.textContent = "Kodu seçtim; Ctrl+C ile kopyala";
  }
});

async function load() {
  if (!orderId || !/^\d+$/.test(orderId)) {
    message.textContent = "Geçersiz sipariş numarası.";
    return;
  }
  if (!trackingCode) {
    byId("tutar").textContent = "—";
    message.textContent = "Bu sipariş bu oturumda oluşturulmadı. Durumunu Sipariş Takibi sayfasından görebilirsin.";
    return;
  }

  try {
    const { order } = await api(`/api/orders/${encodeURIComponent(orderId)}/payment-summary`, {
      method: "POST",
      body: { trackingCode }
    });
    byId("tutar").textContent = money(order.total);
    if (order.status !== "Ödeme bekleniyor") {
      message.textContent = `Bu sipariş daha önce işlenmiş. Durum: ${order.status}`;
      return;
    }
    setButtons(true);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function submitResult(successful) {
  setButtons(false);
  message.textContent = "Test sonucu işleniyor...";
  try {
    await api(`/api/orders/${encodeURIComponent(orderId)}/test-payment`, {
      method: "POST",
      body: { successful, trackingCode }
    });
    if (successful) {
      clearCart();
      message.textContent = `TEST BAŞARILI! Sipariş numaranız: ${orderId}. Gerçek ödeme alınmadı.`;
    } else {
      message.textContent = "Test ödemesi başarısız olarak işaretlendi, stok iade edildi. Gerçek ödeme alınmadı.";
    }
  } catch (error) {
    message.textContent = error.message;
    setButtons(true);
  }
}

approve.addEventListener("click", () => submitResult(true));
fail.addEventListener("click", () => submitResult(false));

load();
