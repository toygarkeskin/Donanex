<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, RouterView, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";

const auth = useAuthStore();
const cart = useCartStore();
const router = useRouter();

const menuOpen = ref(false);
const accountOpen = ref(false);

const nav = [
  { to: { name: "products" }, label: "Ürünler" },
  { to: { name: "stores" }, label: "Mağazalar" },
  { to: { name: "track" }, label: "Sipariş Takibi" },
  { to: { name: "support" }, label: "Destek" }
];

onMounted(() => {
  // Sepet kayıtsız kullanıcı için de yüklenir.
  if (!cart.loaded) cart.load().catch(() => {});
});

async function signOut() {
  accountOpen.value = false;
  await auth.signOut();
  cart.reset();
  await cart.load().catch(() => {});
  router.push({ name: "home" });
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 text-lg font-bold text-ink-900">
          <span aria-hidden="true">🛒</span> Pazar
        </RouterLink>

        <nav class="hidden flex-1 items-center gap-1 md:flex" aria-label="Ana menü">
          <RouterLink
            v-for="item in nav"
            :key="item.label"
            :to="item.to"
            class="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            active-class="bg-ink-100 text-ink-900"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <RouterLink
            :to="{ name: 'cart' }"
            class="relative rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          >
            <span aria-hidden="true">🛍️</span>
            <span class="sr-only">Sepet</span>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs font-bold leading-5 text-white"
            >
              {{ cart.itemCount > 99 ? "99+" : cart.itemCount }}
            </span>
          </RouterLink>

          <div v-if="auth.isSignedIn" class="relative">
            <button type="button" class="btn-secondary" :aria-expanded="accountOpen" @click="accountOpen = !accountOpen">
              <span aria-hidden="true">👤</span>
              <span class="hidden sm:inline">{{ auth.displayName.split(" ")[0] }}</span>
            </button>

            <div
              v-if="accountOpen"
              class="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
              @click="accountOpen = false"
            >
              <RouterLink :to="{ name: 'account-orders' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Siparişlerim
              </RouterLink>
              <RouterLink :to="{ name: 'account-addresses' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Adreslerim
              </RouterLink>
              <RouterLink :to="{ name: 'account-tickets' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Destek Taleplerim
              </RouterLink>
              <RouterLink :to="{ name: 'account-profile' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Hesap Bilgilerim
              </RouterLink>

              <template v-if="auth.hasStorePanel">
                <hr class="my-1 border-ink-200" />
                <RouterLink :to="{ name: 'store-panel' }" class="block px-4 py-2 text-sm font-medium hover:bg-ink-50">
                  🏪 Mağaza Paneli
                </RouterLink>
              </template>
              <template v-else>
                <hr class="my-1 border-ink-200" />
                <RouterLink :to="{ name: 'account-store-application' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                  Mağaza aç
                </RouterLink>
              </template>

              <RouterLink
                v-if="auth.isSystemAdmin"
                :to="{ name: 'admin-dashboard' }"
                class="block px-4 py-2 text-sm font-medium hover:bg-ink-50"
              >
                ⚙️ Yönetim Paneli
              </RouterLink>

              <hr class="my-1 border-ink-200" />
              <button
                type="button"
                class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                @click="signOut"
              >
                Çıkış yap
              </button>
            </div>
          </div>

          <RouterLink v-else :to="{ name: 'sign-in' }" class="btn-primary">Giriş yap</RouterLink>

          <button
            type="button"
            class="btn-ghost md:hidden"
            :aria-expanded="menuOpen"
            aria-label="Menü"
            @click="menuOpen = !menuOpen"
          >
            ☰
          </button>
        </div>
      </div>

      <nav v-if="menuOpen" class="border-t border-ink-200 px-4 py-2 md:hidden" aria-label="Mobil menü">
        <RouterLink
          v-for="item in nav"
          :key="item.label"
          :to="item.to"
          class="block rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          @click="menuOpen = false"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <RouterView />
    </main>

    <footer class="border-t border-ink-200 bg-white">
      <div class="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-base font-bold text-ink-900">🛒 Pazar</p>
          <p class="mt-2 text-ink-500">Çok satıcılı pazar yeri. Onlarca mağaza, tek sepet.</p>
        </div>
        <div>
          <p class="font-semibold text-ink-800">Alışveriş</p>
          <ul class="mt-2 space-y-1 text-ink-500">
            <li><RouterLink :to="{ name: 'products' }" class="hover:text-brand-600">Tüm ürünler</RouterLink></li>
            <li><RouterLink :to="{ name: 'stores' }" class="hover:text-brand-600">Mağazalar</RouterLink></li>
            <li><RouterLink :to="{ name: 'cart' }" class="hover:text-brand-600">Sepetim</RouterLink></li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-ink-800">Yardım</p>
          <ul class="mt-2 space-y-1 text-ink-500">
            <li><RouterLink :to="{ name: 'track' }" class="hover:text-brand-600">Sipariş takibi</RouterLink></li>
            <li><RouterLink :to="{ name: 'support' }" class="hover:text-brand-600">Destek talebi</RouterLink></li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-ink-800">Satıcı</p>
          <ul class="mt-2 space-y-1 text-ink-500">
            <li>
              <RouterLink :to="{ name: 'account-store-application' }" class="hover:text-brand-600">Mağaza aç</RouterLink>
            </li>
          </ul>
        </div>
      </div>
      <p class="border-t border-ink-200 px-4 py-4 text-center text-xs text-ink-400">
        Pazar — demo ortamı. Ödemeler benzetimdir, gerçek para hareketi olmaz.
      </p>
    </footer>
  </div>
</template>
