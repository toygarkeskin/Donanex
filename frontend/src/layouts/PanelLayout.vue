<script setup>
import { computed, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import ThemeToggle from "../components/ThemeToggle.vue";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const sidebarOpen = ref(false);

const isAdminPanel = computed(() => route.path.startsWith("/yonetim"));
const storeId = computed(() => route.params.storeId || auth.stores[0]?.id);
const activeStore = computed(() => auth.stores.find((store) => store.id === storeId.value));

const adminLinks = [
  { name: "admin-dashboard", label: "Genel bakış", icon: "📊" },
  { name: "admin-stores", label: "Mağazalar", icon: "🏪" },
  { name: "admin-users", label: "Kullanıcılar", icon: "👥" },
  { name: "admin-orders", label: "Siparişler", icon: "📦" },
  { name: "admin-tickets", label: "Destek", icon: "💬" }
];

const storeLinks = computed(() => {
  const params = { storeId: storeId.value };
  return [
    { name: "store-dashboard", label: "Genel bakış", icon: "📊", params },
    { name: "store-products", label: "Ürünler", icon: "🏷️", params },
    { name: "store-orders", label: "Siparişler", icon: "📦", params },
    { name: "store-tickets", label: "Destek", icon: "💬", params },
    { name: "store-members", label: "Çalışanlar", icon: "👥", params },
    { name: "store-settings", label: "Ayarlar", icon: "⚙️", params }
  ];
});

const links = computed(() => (isAdminPanel.value ? adminLinks : storeLinks.value));
const title = computed(() => (isAdminPanel.value ? "Yönetim Paneli" : activeStore.value?.name || "Mağaza Paneli"));

async function signOut() {
  await auth.signOut();
  router.push({ name: "home" });
}
</script>

<template>
  <div class="flex min-h-screen bg-ink-100">
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r border-ink-200 bg-surface transition-transform lg:static lg:translate-x-0"
      :class="{ 'translate-x-0': sidebarOpen }"
    >
      <div class="flex h-16 items-center gap-2 border-b border-ink-200 px-5">
        <RouterLink :to="{ name: 'home' }" class="text-base font-bold text-ink-900">💻 Donanex</RouterLink>
      </div>

      <div class="px-5 py-4">
        <p class="text-xs font-medium uppercase tracking-wide text-ink-400">
          {{ isAdminPanel ? "Sistem" : "Mağaza" }}
        </p>
        <p class="mt-1 truncate text-sm font-semibold text-ink-800">{{ title }}</p>
      </div>

      <nav class="space-y-1 px-3" aria-label="Panel menüsü">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name, params: link.params }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          active-class="bg-brand-50 text-brand-700"
          @click="sidebarOpen = false"
        >
          <span aria-hidden="true">{{ link.icon }}</span> {{ link.label }}
        </RouterLink>
      </nav>

      <div v-if="!isAdminPanel && auth.stores.length > 1" class="mt-6 px-3">
        <p class="px-3 text-xs font-medium uppercase tracking-wide text-ink-400">Diğer mağazalarım</p>
        <RouterLink
          v-for="store in auth.stores.filter((s) => s.id !== storeId)"
          :key="store.id"
          :to="{ name: 'store-dashboard', params: { storeId: store.id } }"
          class="mt-1 block truncate rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"
        >
          {{ store.name }}
        </RouterLink>
      </div>

      <div class="absolute inset-x-0 bottom-0 space-y-1 border-t border-ink-200 p-3">
        <RouterLink
          v-if="auth.isSystemAdmin && !isAdminPanel"
          :to="{ name: 'admin-dashboard' }"
          class="block rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"
        >
          ⚙️ Yönetim paneline geç
        </RouterLink>
        <RouterLink
          v-if="isAdminPanel && auth.hasStorePanel"
          :to="{ name: 'store-panel' }"
          class="block rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"
        >
          🏪 Mağaza paneline geç
        </RouterLink>
        <RouterLink :to="{ name: 'home' }" class="block rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100">
          ← Siteye dön
        </RouterLink>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-night/40 lg:hidden" @click="sidebarOpen = false" />

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-16 items-center gap-3 border-b border-ink-200 bg-surface px-4">
        <button type="button" class="btn-ghost lg:hidden" aria-label="Menü" @click="sidebarOpen = true">☰</button>
        <p class="truncate text-sm font-semibold text-ink-800">{{ title }}</p>
        <div class="ml-auto flex items-center gap-2">
          <span class="hidden text-sm text-ink-500 sm:inline">{{ auth.displayName }}</span>
          <ThemeToggle />
          <button type="button" class="btn-secondary" @click="signOut">Çıkış</button>
        </div>
      </header>

      <main class="min-w-0 flex-1 p-4 lg:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
