<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import {
  buildAuthorizeUrl,
  pendingAuthRequestId,
  renewAuthRequest,
  isAuthRequestExpired,
  reloadWhenRestoredFromCache
} from "../../lib/oauth";
import { useCartStore } from "../../stores/cart";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const cart = useCartStore();

const form = reactive({ fullName: "", email: "", phone: "", password: "" });
const authRequestId = ref(null);
const error = ref("");
const submitting = ref(false);
const merged = ref(0);

const kaldir = reloadWhenRestoredFromCache();
onBeforeUnmount(kaldir);

onMounted(() => {
  authRequestId.value = pendingAuthRequestId();
  if (!cart.loaded) cart.load().catch(() => {});
});

/*
 * Bekleyen giriş isteğinin süresi dolduysa yenisi açılıp kayıt BİR KEZ
 * tekrarlanıyor. Sunucu süreyi hesabı oluşturmadan önce denetliyor; ilk
 * deneme hiçbir şey değiştirmemiş oluyor.
 */
async function kaydet() {
  try {
    return await api.post("/auth/register", { ...form, authRequestId: authRequestId.value });
  } catch (hata) {
    if (!isAuthRequestExpired(hata)) throw hata;
    const yeni = await renewAuthRequest();
    if (!yeni) return null;
    authRequestId.value = yeni;
    return api.post("/auth/register", { ...form, authRequestId: yeni });
  }
}

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    const result = await kaydet();
    if (!result) return;
    merged.value = result.mergedCartItems || 0;
    cart.reset();

    if (result.redirectTo) {
      window.location.assign(result.redirectTo);
      return;
    }
    // Bekleyen bir OAuth isteği yoksa akışı şimdi başlat: oturum zaten açık,
    // sunucu doğrudan kod üretip geri yönlendirir.
    window.location.assign(await buildAuthorizeUrl({ returnTo: route.query.donus || "/" }));
  } catch (requestError) {
    error.value = requestError.message;
    submitting.value = false;
  }
}
</script>

<template>
  <div class="card p-6">
    <h1 class="text-xl font-bold text-ink-900">Hesap oluştur</h1>
    <p class="mt-1 text-sm text-ink-500">Siparişlerinizi takip edin, adreslerinizi kaydedin.</p>

    <AlertBox v-if="cart.itemCount" tone="info" class="mt-4">
      Sepetinizdeki <strong>{{ cart.itemCount }}</strong> ürün kayıt olduğunuzda hesabınıza taşınacak.
    </AlertBox>

    <AlertBox v-if="error" tone="error" class="mt-4">{{ error }}</AlertBox>

    <form class="mt-5 space-y-4" @submit.prevent="submit">
      <FormField id="fullName" label="Ad Soyad" required>
        <input id="fullName" v-model="form.fullName" type="text" class="field" required maxlength="150" autocomplete="name" />
      </FormField>

      <FormField id="email" label="E-posta" required>
        <input id="email" v-model="form.email" type="email" class="field" required maxlength="254" autocomplete="email" />
      </FormField>

      <FormField id="phone" label="Telefon">
        <input id="phone" v-model="form.phone" type="tel" class="field" maxlength="30" autocomplete="tel" />
      </FormField>

      <FormField
        id="password"
        label="Parola"
        required
        hint="En az 10 karakter; harf ve rakam içermeli."
      >
        <input
          id="password"
          v-model="form.password"
          type="password"
          class="field"
          required
          minlength="10"
          maxlength="200"
          autocomplete="new-password"
        />
      </FormField>

      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? "Hesap oluşturuluyor…" : "Hesap oluştur" }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-ink-500">
      Zaten hesabınız var mı?
      <RouterLink :to="{ name: 'sign-in', query: route.query }" class="font-semibold text-brand-600">
        Giriş yapın
      </RouterLink>
    </p>
  </div>
</template>
