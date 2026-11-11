<script setup>
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();

const links = [
  { name: "account-orders", label: "Siparişlerim", icon: "📦" },
  { name: "account-addresses", label: "Adreslerim", icon: "📍" },
  { name: "account-tickets", label: "Destek Taleplerim", icon: "💬" },
  { name: "account-profile", label: "Hesap Bilgilerim", icon: "👤" }
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
          <span aria-hidden="true">{{ link.icon }}</span> {{ link.label }}
        </RouterLink>

        <RouterLink
          v-if="auth.hasStorePanel"
          :to="{ name: 'store-panel' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
        >
          <span aria-hidden="true">🏪</span> Mağaza Paneli
        </RouterLink>
        <RouterLink
          v-else
          :to="{ name: 'account-store-application' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          active-class="bg-brand-50 text-brand-700"
        >
          <span aria-hidden="true">🏪</span> Mağaza Aç
        </RouterLink>
      </nav>
    </aside>

    <div class="min-w-0"><RouterView /></div>
  </div>
</template>
