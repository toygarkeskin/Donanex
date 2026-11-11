<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const router = useRouter();

/** /magaza adresi kişinin ilk mağazasına yönlendirir (e-postalardaki bağlantı). */
onMounted(() => {
  const first = auth.stores[0];
  router.replace(
    first ? { name: "store-dashboard", params: { storeSlug: first.slug } } : { name: "account-store-application" }
  );
});
</script>

<template>
  <p class="text-sm text-ink-500">Mağaza paneline yönlendiriliyorsunuz…</p>
</template>
