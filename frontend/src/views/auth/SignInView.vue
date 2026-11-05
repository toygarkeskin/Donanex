<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../../lib/api";
import { startLogin, pendingAuthRequestId } from "../../lib/oauth";
import { useCartStore } from "../../stores/cart";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const router = useRouter();
const cart = useCartStore();

const form = reactive({ email: "", password: "" });
const authRequestId = ref(null);
const error = ref("");
const submitting = ref(false);

/**
 * Giriş formu uygulamanın içindedir, ama akış standart OAuth yetkilendirme
 * kodu akışıdır: sunucu bekleyen isteği tamamlar ve dönülecek adresi verir.
 *
 * Doğrudan /giris adresine gelindiyse (bekleyen istek yoksa) önce
 * /oauth/authorize başlatılır.
 */
onMounted(async () => {
  authRequestId.value = pendingAuthRequestId();
  if (!authRequestId.value) {
    await startLogin({ returnTo: route.query.donus || "/" });
  }
});

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    const result = await api.post("/auth/sign-in", {
      email: form.email,
      password: form.password,
      authRequestId: authRequestId.value
    });
    if (result.mergedCartItems) cart.reset();
    // Sunucu yetkilendirme kodunu üretti; istemci jetonu callback'te alır.
    window.location.assign(result.redirectTo);
  } catch (requestError) {
    error.value = requestError.message;
    submitting.value = false;
  }
}
</script>

<template>
  <div class="card p-6">
    <h1 class="text-xl font-bold text-ink-900">Giriş yap</h1>
    <p class="mt-1 text-sm text-ink-500">Hesabınıza girerek siparişlerinizi takip edin.</p>

    <AlertBox v-if="error" tone="error" class="mt-4">{{ error }}</AlertBox>

    <form v-if="authRequestId" class="mt-5 space-y-4" @submit.prevent="submit">
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
        {{ submitting ? "Giriş yapılıyor…" : "Giriş yap" }}
      </button>
    </form>

    <p v-else class="mt-5 text-sm text-ink-500">Giriş ekranı hazırlanıyor…</p>

    <p class="mt-6 text-center text-sm text-ink-500">
      Hesabınız yok mu?
      <RouterLink :to="{ name: 'register', query: route.query }" class="font-semibold text-brand-600">
        Kayıt olun
      </RouterLink>
    </p>
  </div>
</template>
