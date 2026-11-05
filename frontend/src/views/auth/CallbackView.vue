<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { exchangeCode } from "../../lib/oauth";
import { useAuthStore } from "../../stores/auth";
import { useCartStore } from "../../stores/cart";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const cart = useCartStore();
const error = ref("");

/** Yetkilendirme kodunu jetona çevirir ve kullanıcıyı geldiği yere döndürür. */
onMounted(async () => {
  if (route.query.error) {
    error.value = route.query.error_description || "Giriş iptal edildi.";
    return;
  }
  try {
    const { accessToken, returnTo } = await exchangeCode({
      code: route.query.code,
      state: route.query.state
    });
    await auth.completeSignIn(accessToken);
    await cart.load().catch(() => {});
    router.replace(returnTo);
  } catch (exchangeError) {
    error.value = exchangeError.message;
  }
});
</script>

<template>
  <div class="card p-6 text-center">
    <template v-if="!error">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      <p class="mt-4 text-sm text-ink-600">Giriş tamamlanıyor…</p>
    </template>

    <template v-else>
      <AlertBox tone="error">{{ error }}</AlertBox>
      <RouterLink :to="{ name: 'sign-in' }" class="btn-primary mt-4">Tekrar deneyin</RouterLink>
    </template>
  </div>
</template>
