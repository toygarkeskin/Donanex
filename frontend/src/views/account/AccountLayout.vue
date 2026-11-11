<script setup>
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "../../stores/auth";
import AppIcon from "../../components/AppIcon.vue";

const auth = useAuthStore();

const links = [
  { name: "account-orders", label: "Siparişlerim", icon: "kargo" },
  { name: "account-addresses", label: "Adreslerim", icon: "konum" },
  { name: "account-tickets", label: "Destek Taleplerim", icon: "destek" },
  { name: "account-profile", label: "Hesap Bilgilerim", icon: "hesap" }
];
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside class="card h-fit p-3">
      <p class="px-3 py-2 text-sm font-semibold text-ink-800">{{ auth.displayName }}</p>
      <nav class="mt-1 space-y-1" aria-label="Hesap menüsü">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          active-class="bg-brand-50 text-brand-700"
        >
          <AppIcon :name="link.icon" :size="18" /> {{ link.label }}
        </RouterLink>

        <RouterLink
          v-if="auth.hasStorePanel"
          :to="{ name: 'store-panel' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
        >
          <AppIcon name="magaza" :size="18" /> Mağaza Paneli
        </RouterLink>
        <RouterLink
          v-else
          :to="{ name: 'account-store-application' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          active-class="bg-brand-50 text-brand-700"
        >
          <AppIcon name="magaza" :size="18" /> Mağaza Aç
        </RouterLink>
      </nav>
    </aside>

    <div class="min-w-0"><RouterView /></div>
  </div>
</template>
