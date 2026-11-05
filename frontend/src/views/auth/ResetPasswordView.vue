<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { api } from "../../lib/api";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const router = useRouter();
const form = reactive({ password: "", confirm: "" });
const token = ref("");
const error = ref("");
const done = ref(false);
const submitting = ref(false);

/**
 * Jeton adresin "#" kısmında taşınır: bu kısım sunucuya GÖNDERİLMEZ, bu yüzden
 * erişim günlüklerine ve Referer başlığına düşmez. Okuduktan sonra adres
 * çubuğundan da silinir.
 */
onMounted(() => {
  token.value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
  if (token.value) history.replaceState(null, "", window.location.pathname);
  else error.value = "Sıfırlama bağlantısı geçersiz. Lütfen yeni bir bağlantı isteyin.";
});

async function submit() {
  error.value = "";
  if (form.password !== form.confirm) {
    error.value = "Parolalar birbiriyle aynı değil.";
    return;
  }
  submitting.value = true;
  try {
    await api.post("/auth/password/reset", { token: token.value, password: form.password });
    done.value = true;
    setTimeout(() => router.push({ name: "sign-in" }), 2000);
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="card p-6">
    <h1 class="text-xl font-bold text-ink-900">Yeni parola belirle</h1>

    <AlertBox v-if="done" tone="success" class="mt-4">
      Parolanız güncellendi. Giriş sayfasına yönlendiriliyorsunuz…
    </AlertBox>
    <AlertBox v-else-if="error" tone="error" class="mt-4">{{ error }}</AlertBox>

    <form v-if="token && !done" class="mt-5 space-y-4" @submit.prevent="submit">
      <FormField id="password" label="Yeni parola" required hint="En az 10 karakter; harf ve rakam içermeli.">
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

      <FormField id="confirm" label="Yeni parola (tekrar)" required>
        <input
          id="confirm"
          v-model="form.confirm"
          type="password"
          class="field"
          required
          minlength="10"
          maxlength="200"
          autocomplete="new-password"
        />
      </FormField>

      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? "Güncelleniyor…" : "Parolayı güncelle" }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-ink-500">
      <RouterLink :to="{ name: 'forgot-password' }" class="font-semibold text-brand-600">
        Yeni bağlantı iste
      </RouterLink>
    </p>
  </div>
</template>
