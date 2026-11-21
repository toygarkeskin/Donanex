<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import {
  startLogin,
  pendingAuthRequestId,
  renewAuthRequest,
  isAuthRequestExpired,
  reloadWhenRestoredFromCache
} from "../../lib/oauth";
import { useAuthStore } from "../../stores/auth";
import { useCartStore } from "../../stores/cart";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const auth = useAuthStore();
const cart = useCartStore();

const form = reactive({ email: "", password: "" });
const authRequestId = ref(null);
const error = ref("");
const info = ref("");
const submitting = ref(false);

/*
 * İkinci adım: e-postadaki 6 haneli kod. Parola doğruysa sunucu oturumu
 * hemen açmıyor, { verificationRequired, challengeId } dönüyor. "Bu cihazı
 * hatırla" işaretlenirse o tarayıcıda 30 gün kod sorulmuyor.
 */
const adim = ref("parola");
const challengeId = ref(null);
const maskedEmail = ref("");
const kod = ref("");
const hatirla = ref(false);
const kodAlani = ref(null);
const bekleme = ref(0);
let sayac = null;

const kodTam = computed(() => /^\d{6}$/.test(kod.value.replace(/\s+/g, "")));

/**
 * Giriş formu uygulamanın içindedir, ama akış standart OAuth yetkilendirme
 * kodu akışıdır: sunucu bekleyen isteği tamamlar ve dönülecek adresi verir.
 *
 * Doğrudan /giris adresine gelindiyse (bekleyen istek yoksa) önce
 * /oauth/authorize başlatılır — adres DEĞİŞTİRİLEREK (replace): `/giris`
 * geçmişte kalırsa geri tuşu buraya döner ve kullanıcı tekrar ileri atılır.
 *
 * Oturum zaten açıksa (girişten sonra geri tuşuyla dönüldü) form
 * gösterilmez; kullanıcı gideceği yere gönderilir.
 */
const kaldir = reloadWhenRestoredFromCache();

onMounted(async () => {
  if (auth.isSignedIn) {
    window.location.replace(typeof route.query.donus === "string" ? route.query.donus : "/");
    return;
  }
  authRequestId.value = pendingAuthRequestId();
  if (!authRequestId.value) {
    await startLogin({ returnTo: route.query.donus || "/", replace: true });
  }
});

onBeforeUnmount(() => {
  clearInterval(sayac);
  kaldir();
});

/**
 * İsteği gönderir; bekleyen giriş isteğinin süresi dolmuşsa (sayfa 15
 * dakikadan uzun açık kaldı) yenisini açıp BİR KEZ tekrarlar. Sunucu süreyi
 * işlemden önce denetliyor: ilk deneme hiçbir şey değiştirmemiş oluyor.
 */
async function gonder(yol, govde) {
  try {
    return await api.post(yol, { ...govde, authRequestId: authRequestId.value });
  } catch (hata) {
    if (!isAuthRequestExpired(hata)) throw hata;
    const yeni = await renewAuthRequest();
    if (!yeni) return null; // açık oturum bulundu, sayfa yönlendiriliyor
    authRequestId.value = yeni;
    return api.post(yol, { ...govde, authRequestId: yeni });
  }
}

function beklemeBaslat(saniye) {
  clearInterval(sayac);
  bekleme.value = saniye;
  sayac = setInterval(() => {
    bekleme.value -= 1;
    if (bekleme.value <= 0) clearInterval(sayac);
  }, 1000);
}

/** Oturum açıldı: sunucu yetkilendirme kodunu üretti, istemci jetonu callback'te alır. */
function bitir(result) {
  if (result.mergedCartItems) cart.reset();
  window.location.assign(result.redirectTo);
}

async function submit() {
  error.value = "";
  info.value = "";
  submitting.value = true;
  try {
    const result = await gonder("/auth/sign-in", { email: form.email, password: form.password });
    if (!result) return;
    if (result.verificationRequired) {
      challengeId.value = result.challengeId;
      maskedEmail.value = result.maskedEmail;
      kod.value = "";
      adim.value = "kod";
      submitting.value = false;
      beklemeBaslat(30);
      await nextTick();
      kodAlani.value?.focus();
      return;
    }
    bitir(result);
  } catch (requestError) {
    error.value = requestError.message;
    submitting.value = false;
  }
}

async function dogrula() {
  if (!kodTam.value || submitting.value) return;
  error.value = "";
  info.value = "";
  submitting.value = true;
  try {
    const result = await gonder("/auth/sign-in/verify", {
      challengeId: challengeId.value,
      code: kod.value,
      rememberDevice: hatirla.value
    });
    if (result) bitir(result);
  } catch (requestError) {
    submitting.value = false;
    // Kod öldüyse (süre, deneme sınırı) parola adımına dönülüyor; mesaj kalıyor.
    if (/yeniden giriş/i.test(requestError.message)) geriDon();
    error.value = requestError.message;
    kod.value = "";
    await nextTick();
    kodAlani.value?.focus();
  }
}

async function yenidenGonder() {
  error.value = "";
  info.value = "";
  try {
    const result = await api.post("/auth/sign-in/resend", { challengeId: challengeId.value });
    kod.value = "";
    info.value = "Yeni kod gönderildi. Önceki kod artık geçersiz.";
    beklemeBaslat(result.retryAfterSeconds ?? 30);
  } catch (requestError) {
    if (/yeniden giriş/i.test(requestError.message)) geriDon();
    error.value = requestError.message;
  }
}

function geriDon() {
  adim.value = "parola";
  challengeId.value = null;
  kod.value = "";
  form.password = "";
  clearInterval(sayac);
  bekleme.value = 0;
}

/* Rakam dışını at; 6 hane dolunca kendiliğinden gönder (yapıştırma dahil). */
function kodGirildi(olay) {
  kod.value = olay.target.value.replace(/\D/g, "").slice(0, 6);
  if (kodTam.value) dogrula();
}
</script>

<template>
  <div class="card p-6">
    <template v-if="adim === 'parola'">
      <h1 class="text-xl font-bold text-ink-900">Giriş yap</h1>
      <p class="mt-1 text-sm text-ink-500">Hesabınıza girerek siparişlerinizi takip edin.</p>
    </template>
    <template v-else>
      <h1 class="text-xl font-bold text-ink-900">Doğrulama kodu</h1>
      <p class="mt-1 text-sm text-ink-500">
        <strong class="text-ink-700">{{ maskedEmail }}</strong> adresine 6 haneli bir kod gönderdik. Kod 10 dakika geçerli.
      </p>
    </template>

    <AlertBox v-if="error" tone="error" class="mt-4">{{ error }}</AlertBox>
    <AlertBox v-if="info" tone="success" class="mt-4">{{ info }}</AlertBox>

    <form v-if="authRequestId && adim === 'parola'" class="mt-5 space-y-4" @submit.prevent="submit">
      <FormField id="email" label="E-posta" required>
        <input id="email" v-model="form.email" type="email" class="field" required autocomplete="email" maxlength="254" />
      </FormField>

      <FormField id="password" label="Parola" required>
        <input
          id="password"
          v-model="form.password"
          type="password"
          class="field"
          required
          autocomplete="current-password"
          maxlength="200"
        />
      </FormField>

      <div class="flex justify-end">
        <RouterLink :to="{ name: 'forgot-password' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Parolamı unuttum
        </RouterLink>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? "Kontrol ediliyor…" : "Devam et" }}
      </button>
    </form>

    <form v-else-if="adim === 'kod'" class="mt-5 space-y-4" @submit.prevent="dogrula">
      <FormField id="giris-kodu" label="Doğrulama kodu" required>
        <input
          id="giris-kodu"
          ref="kodAlani"
          :value="kod"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          pattern="\d{6}"
          required
          placeholder="000000"
          class="field text-center font-mono text-2xl tracking-[0.5em]"
          aria-describedby="giris-kodu-ipucu"
          @input="kodGirildi"
        />
      </FormField>
      <p id="giris-kodu-ipucu" class="-mt-2 text-xs text-ink-500">E-postayı göremiyorsanız gereksiz klasörüne bakın.</p>

      <label class="flex items-center gap-2 text-sm text-ink-700">
        <input v-model="hatirla" type="checkbox" class="size-4 rounded border-ink-300 text-brand-600" />
        Bu cihazı 30 gün hatırla
      </label>

      <button type="submit" class="btn-primary w-full" :disabled="submitting || !kodTam">
        {{ submitting ? "Doğrulanıyor…" : "Giriş yap" }}
      </button>

      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" class="font-medium text-ink-500 hover:text-ink-800" @click="geriDon">← Farklı hesap</button>
        <button
          type="button"
          class="font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-ink-400"
          :disabled="bekleme > 0"
          @click="yenidenGonder"
        >
          {{ bekleme > 0 ? `Yeni kod (${bekleme} sn)` : "Kodu yeniden gönder" }}
        </button>
      </div>
    </form>

    <p v-else class="mt-5 text-sm text-ink-500">Giriş ekranı hazırlanıyor…</p>

    <p v-if="adim === 'parola'" class="mt-6 text-center text-sm text-ink-500">
      Hesabınız yok mu?
      <RouterLink :to="{ name: 'register', query: route.query }" class="font-semibold text-brand-600">
        Kayıt olun
      </RouterLink>
    </p>
  </div>
</template>
