<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import AlertBox from "../../components/AlertBox.vue";

const state = ref("checking");
const message = ref("");

onMounted(async () => {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (token) history.replaceState(null, "", window.location.pathname);

  if (!token) {
    state.value = "error";
    message.value = "Doğrulama bağlantısı geçersiz.";
    return;
  }
  try {
    const result = await api.post("/auth/email/verify", { token });
    state.value = "done";
    message.value = result.message;
  } catch (error) {
    state.value = "error";
    message.value = error.message;
  }
});
</script>

<template>
  <div class="card p-6 text-center">
    <h1 class="text-xl font-bold text-ink-900">E-posta doğrulama</h1>

    <p v-if="state === 'checking'" class="mt-4 text-sm text-ink-600">Doğrulanıyor…</p>
    <AlertBox v-else :tone="state === 'done' ? 'success' : 'error'" class="mt-4">{{ message }}</AlertBox>

    <RouterLink :to="{ name: 'home' }" class="btn-primary mt-5">Ana sayfaya dön</RouterLink>
  </div>
</template>
