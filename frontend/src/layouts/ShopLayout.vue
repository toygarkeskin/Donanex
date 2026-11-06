<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { useCatalogStore } from "../stores/catalog";
import ThemeToggle from "../components/ThemeToggle.vue";
import BrandLogo from "../components/BrandLogo.vue";

const auth = useAuthStore();
const cart = useCartStore();
const catalog = useCatalogStore();
const router = useRouter();
const route = useRoute();

const menuOpen = ref(false);
const accountOpen = ref(false);
const hesapKutusu = ref(null);

/*
 * Arama her sayfada başlıkta durur.
 *
 * Önceden arama yalnızca ürün listesinin kenar çubuğundaydı: ana sayfadaki
 * bir kullanıcının arama yapması için önce "Ürünler"e gitmesi gerekiyordu.
 * Kutu, aramayı ürün listesine taşıyarak çalışır — filtreler adres çubuğunda
 * yaşadığı için sonuç sayfası paylaşılabilir ve geri tuşu çalışmayı sürdürür.
 */
const aramaMetni = ref(route.query.ara ?? "");

function aramayiGonder() {
  const terim = aramaMetni.value.trim();
  router.push({ name: "products", query: terim ? { ara: terim } : {} });
}

// Kullanıcı ürün listesinde filtreyi değiştirirse kutu da onu göstersin.
watch(
  () => route.query.ara,
  (yeni) => {
    aramaMetni.value = yeni ?? "";
  }
);

// "Destek" buradan kaldırıldı: hesap menüsüne ve alt bilgiye taşındı.
const nav = [
  { to: { name: "products" }, label: "Ürünler" },
  { to: { name: "stores" }, label: "Mağazalar" },
  { to: { name: "track" }, label: "Sipariş Takibi" }
];

/*
 * Açılır menüleri kapatma.
 *
 * Önceden yalnızca düğmeye ikinci kez basınca kapanıyordu; kullanıcı sayfanın
 * başka bir yerine tıkladığında menü açık kalıyordu. Üç kapanma yolu var:
 * dışarı tıklama, Esc ve sayfa değişimi.
 */
function disaridaTiklandi(olay) {
  // Menünün kendi içindeki tıklamalar (düğme dahil) menüyü kapatmamalı.
  if (hesapKutusu.value && !hesapKutusu.value.contains(olay.target)) {
    accountOpen.value = false;
  }
}

function tusaBasildi(olay) {
  if (olay.key !== "Escape") return;
  accountOpen.value = false;
  menuOpen.value = false;
}

onMounted(() => {
  // Sepet kayıtsız kullanıcı için de yüklenir.
  if (!cart.loaded) cart.load().catch(() => {});
  // Kategori şeridi; hata yutulur, şerit boş kalsa da sayfa çalışır.
  catalog.load();
  document.addEventListener("click", disaridaTiklandi);
  document.addEventListener("keydown", tusaBasildi);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", disaridaTiklandi);
  document.removeEventListener("keydown", tusaBasildi);
});

// Başka bir sayfaya geçilince açık kalan menü kapanır.
watch(
  () => route.fullPath,
  () => {
    accountOpen.value = false;
    menuOpen.value = false;
  }
);

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
    <header class="sticky top-0 z-30 border-b border-ink-200 bg-surface/95 backdrop-blur">
      <!--
        Dar ekranda arama KENDİ SATIRINA iner (order-last + w-full). Tek
        satırda tutulduğunda logo, sepet, tema ve hesap düğmeleriyle birlikte
        375px'e sığmıyor ve kutu okunamayacak kadar eziliyordu.
      -->
      <div class="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:flex-nowrap md:py-0">
        <RouterLink :to="{ name: 'home' }" class="shrink-0" aria-label="Donanex ana sayfa">
          <BrandLogo />
        </RouterLink>

        <nav class="hidden items-center gap-1 lg:flex" aria-label="Ana menü">
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

        <form
          class="order-last flex w-full min-w-0 items-center md:order-none md:w-auto md:flex-1"
          role="search"
          @submit.prevent="aramayiGonder"
        >
          <label for="site-arama" class="sr-only">Ürün ara</label>
          <div class="relative w-full">
            <input
              id="site-arama"
              v-model="aramaMetni"
              type="search"
              name="ara"
              placeholder="Ürün, marka veya mağaza ara"
              class="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">
              🔍
            </span>
          </div>
        </form>

        <div class="ml-auto flex shrink-0 items-center gap-2">
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

          <ThemeToggle />

          <div v-if="auth.isSignedIn" ref="hesapKutusu" class="relative">
            <button type="button" class="btn-secondary" :aria-expanded="accountOpen" @click="accountOpen = !accountOpen">
              <span aria-hidden="true">👤</span>
              <span class="hidden sm:inline">{{ auth.displayName.split(" ")[0] }}</span>
            </button>

            <div
              v-if="accountOpen"
              class="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-surface py-1 shadow-lg"
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

              <hr class="my-1 border-ink-200" />
              <RouterLink :to="{ name: 'support' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Destek
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
                class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-ink-100"
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

      <nav v-if="menuOpen" class="border-t border-ink-200 px-4 py-2 lg:hidden" aria-label="Mobil menü">
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

      <!--
        Kategori şeridi: her sayfadan tek tıkla kategoriye geçilir. Daha önce
        kategoriler yalnızca ana sayfadaydı; bir ürün sayfasındayken başka
        kategoriye bakmak için önce ana sayfaya dönmek gerekiyordu.
        Dar ekranda yatay kayar, satır sarmaz — başlık yüksekliği sabit kalır.
      -->
      <nav
        v-if="catalog.categories.length"
        class="border-t border-ink-200 bg-surface"
        aria-label="Kategoriler"
      >
        <div class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <RouterLink
            v-for="kategori in catalog.categories"
            :key="kategori.id"
            :to="{ name: 'products', query: { kategori: kategori.slug } }"
            class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            :class="route.query.kategori === kategori.slug ? 'bg-ink-100 text-ink-900' : ''"
          >
            {{ kategori.name }}
          </RouterLink>
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <RouterView />
    </main>

    <footer class="border-t border-ink-200 bg-surface">
      <div class="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandLogo :size="28" />
          <p class="mt-2 text-ink-500">Çok satıcılı teknoloji mağazası. Onlarca mağaza, tek sepet.</p>
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
        Donanex — demo ortamı. Ödemeler benzetimdir, gerçek para hareketi olmaz.
      </p>
    </footer>
  </div>
</template>
