<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const email = ref("");
const message = ref("");
const submitting = ref(false);

/**
 * Yanıt her zaman aynıdır: bir e-postanın kayıtlı olup olmadığı bu uçtan
 * anlaşılamaz. Bu bilinçli bir tercihtir (hesap sayımını engeller).
 */
async function submit() {
  submitting.value = true;
  try {
    const result = await api.post("/auth/password/forgot", { email: email.value });
    message.value = result.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="card p-6">
    <h1 class="text-xl font-bold text-ink-900">Parolamı unuttum</h1>
    <p class="mt-1 text-sm text-ink-500">E-posta adresinize sıfırlama bağlantısı gönderelim.</p>

    <AlertBox v-if="message" tone="success" class="mt-4">{{ message }}</AlertBox>

    <form v-else class="mt-5 space-y-4" @submit.prevent="submit">
      <FormField id="email" label="E-posta" required>
        <input id="email" v-model="email" type="email" class="field" required maxlength="254" autocomplete="email" />
      </FormField>
      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder" }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-ink-500">
      <RouterLink :to="{ name: 'sign-in' }" class="font-semibold text-brand-600">Girişe dön</RouterLink>
    </p>
  </div>
</template>
