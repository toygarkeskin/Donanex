<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { useCatalogStore } from "../stores/catalog";
import ThemeToggle from "../components/ThemeToggle.vue";
import BrandLogo from "../components/BrandLogo.vue";
import AppIcon from "../components/AppIcon.vue";
import SiteSearch from "../components/SiteSearch.vue";
import CategoryStrip from "../components/CategoryStrip.vue";

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
  { to: { name: "products" }, label: "Ürünler", icon: "urunler" },
  { to: { name: "stores" }, label: "Mağazalar", icon: "magaza" },
  { to: { name: "track" }, label: "Sipariş Takibi", icon: "kargo" }
];

/**
 * Telefondaki alt çubuk.
 *
 * Dört yol: en sık kullanılanlar. Hesap girişi oturuma göre değişiyor —
 * giriş yapılmamışsa doğrudan giriş sayfasına götürür, yoksa kullanıcı
 * hesabım'a basıp boş bir ekranla karşılaşırdı.
 */
const altGezinme = computed(() => [
  { to: { name: "home" }, label: "Ana sayfa", icon: "ev" },
  { to: { name: "products" }, label: "Ürünler", icon: "urunler" },
  { to: { name: "cart" }, label: "Sepetim", icon: "sepet", rozet: true },
  auth.isSignedIn
    ? { to: { name: "account-orders" }, label: "Hesabım", icon: "hesap" }
    : { to: { name: "sign-in" }, label: "Giriş", icon: "hesap" }
]);

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
    <!--
      Yapışkan olan YALNIZCA üst satır (logo + düğmeler).
      Arama ve kategori şeridi onun dışında, normal akışta duruyor; telefonda
      sayfayla birlikte yukarı kayıp gidiyorlar. Üçü birden yapışkan olsaydı
      812px'lik bir ekranda görünür alanın dörtte biri kalıcı olarak başlığa
      giderdi.

      Bu üç parça AYRI kardeşler, iç içe değil: yapışkan bir eleman ancak
      ebeveyninin sınırları içinde yapışır. Üst satır başlık kutusunun içinde
      kalsaydı, başlık ekrandan çıktığı anda o da onunla birlikte giderdi.
    -->
    <!--
      Menü açıkken başlık mat zeminin ÜSTÜNE çıkıyor (z-50).
      Açılan panel başlığın içinde duruyor; başlık kendi yığın bağlamını
      kurduğu için paneldeki z-50 dışarıdaki zemini aşamıyordu — panel
      karartmanın altında kalıyordu. Başlığın kendisinin aydınlık kalması
      zaten istenen davranış: kullanıcı nereden açtığını görüyor.
    -->
    <header
      class="sticky top-0 border-b border-ink-200 bg-surface/95 backdrop-blur"
      :class="menuOpen ? 'z-50' : 'z-30'"
    >
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:h-16 lg:gap-4">
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

          <!-- Geniş ekranda arama logoyla aynı satırda; telefonda alttaki satırda. -->
          <div class="hidden min-w-0 flex-1 md:block">
            <SiteSearch id="site-arama" v-model="aramaMetni" @gonder="aramayiGonder" />
          </div>

          <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <!--
              Sepet simgesi telefonda GİZLİ: alt çubukta rozetiyle birlikte
              zaten var. İki kopya 375px'te yer yiyordu.
            -->
            <RouterLink
              :to="{ name: 'cart' }"
              class="relative hidden rounded-lg p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900 lg:block"
            >
              <AppIcon name="sepet" />
              <span class="sr-only">Sepet</span>
              <span
                v-if="cart.itemCount > 0"
                class="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs font-bold leading-5 text-white"
              >
                {{ cart.itemCount > 99 ? "99+" : cart.itemCount }}
              </span>
            </RouterLink>

            <ThemeToggle />

            <div v-if="auth.isSignedIn" ref="hesapKutusu" class="relative">
              <button
                type="button"
                class="btn-secondary"
                :aria-expanded="accountOpen"
                @click="accountOpen = !accountOpen"
              >
                <AppIcon name="hesap" :size="18" />
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
                  <RouterLink
                    :to="{ name: 'store-panel' }"
                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-ink-50"
                  >
                    <AppIcon name="magaza" :size="16" /> Mağaza Paneli
                  </RouterLink>
                </template>
                <template v-else>
                  <hr class="my-1 border-ink-200" />
                  <RouterLink
                    :to="{ name: 'account-store-application' }"
                    class="block px-4 py-2 text-sm hover:bg-ink-50"
                  >
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

            <!--
              lg:hidden — md:hidden değil. Önceden tablet genişliğinde (768–1024)
              hem ana menü (hidden lg:flex) hem de bu düğme gizliydi: o aralıkta
              "Mağazalar" ve "Sipariş Takibi" sayfalarına hiçbir yoldan
              ulaşılamıyordu.
            -->
            <button
              type="button"
              class="btn-ghost lg:hidden"
              :aria-expanded="menuOpen"
              aria-label="Menü"
              @click="menuOpen = !menuOpen"
            >
              <AppIcon name="menu" :size="18" />
            </button>
        </div>
      </div>

      <!--
        Hamburger menüsü.

        Önceden başlığın altına açılan ve sayfayı aşağı iten bir listeydi:
        üç bağlantı için ekranın üst şeridini kaplıyordu. Artık düğmenin
        hizasında duran, kendi genişliği kadar yer kaplayan bir panel;
        arkasındaki sayfa soluklaşıyor ki panelin nerede bittiği belli olsun
        ve dışarı basınca kapansın.
      -->
      <Transition
        enter-from-class="opacity-0 -translate-y-1"
        leave-to-class="opacity-0 -translate-y-1"
        enter-active-class="transition duration-150"
        leave-active-class="transition duration-150"
      >
        <nav
          v-if="menuOpen"
          class="absolute right-3 top-[calc(100%-0.25rem)] z-50 w-56 overflow-hidden rounded-xl border border-ink-200 bg-surface py-1 shadow-lg lg:hidden"
          aria-label="Mobil menü"
        >
          <RouterLink
            v-for="item in nav"
            :key="item.label"
            :to="item.to"
            class="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
            active-class="text-brand-700"
            @click="menuOpen = false"
          >
            <AppIcon :name="item.icon" :size="17" />
            {{ item.label }}
          </RouterLink>
        </nav>
      </Transition>
    </header>

    <Transition
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition-opacity"
      leave-active-class="transition-opacity"
    >
      <div v-if="menuOpen" class="mat-zemin lg:hidden" @click="menuOpen = false" />
    </Transition>

    <!-- Telefonda arama: kendi satırında ve yapışkan DEĞİL. -->
    <div class="border-b border-ink-200 bg-surface px-4 py-2 md:hidden">
      <SiteSearch id="site-arama-mobil" v-model="aramaMetni" @gonder="aramayiGonder" />
    </div>

    <!--
      Kategori şeridi: her sayfadan tek tıkla kategoriye geçilir. Daha önce
      kategoriler yalnızca ana sayfadaydı; bir ürün sayfasındayken başka
      kategoriye bakmak için önce ana sayfaya dönmek gerekiyordu.

      lg:sticky lg:top-16 — geniş ekranda başlığın (64px) hemen altına yapışır;
      telefonda yapışmaz, sayfayla birlikte kayar.
    -->
    <CategoryStrip :categories="catalog.categories" class="lg:sticky lg:top-16 lg:z-20" />

    <!--
      pb-20: alt gezinme çubuğu sabit konumlu, yani akıştan çıkmış durumda.
      Alt boşluk olmasaydı sayfanın son satırı çubuğun ardında kalırdı.
      lg'de çubuk gizlendiği için boşluk da kalkıyor.
    -->
    <main class="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 pt-4 sm:py-8 lg:pb-8">
      <RouterView />
    </main>

    <!--
      Telefonda alt gezinme çubuğu.
      Başparmağın eriştiği yer ekranın altı; en sık kullanılan dört yol
      (ana sayfa, ürünler, sepet, hesap) başlıktaki küçük simgeler yerine
      buraya alındı. Geniş ekranda gizli — orada başlık zaten yetiyor.

      pb-[env(safe-area-inset-bottom)]: çentikli telefonlarda ana sayfa
      çizgisinin çubuğun üstüne binmemesi için.
    -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Alt gezinme"
    >
      <div class="grid grid-cols-4">
        <RouterLink
          v-for="item in altGezinme"
          :key="item.label"
          :to="item.to"
          class="relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium text-ink-500"
          active-class="text-brand-600"
        >
          <AppIcon :name="item.icon" :size="21" />
          {{ item.label }}
          <span
            v-if="item.rozet && cart.itemCount > 0"
            class="absolute right-1/2 top-1 min-w-4 translate-x-3 rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold leading-4 text-white"
          >
            {{ cart.itemCount > 9 ? "9+" : cart.itemCount }}
          </span>
        </RouterLink>
      </div>
    </nav>

    <!--
      Alt bilgi.
      Önceden dört blok alt alta diziliyordu: telefonda 400 pikselden uzun,
      neredeyse yarım ekran boyunda bir kuyruk oluyordu. Artık marka bloğu
      solda, üç bağlantı grubu YAN YANA — telefonda bile üç sütun, çünkü
      listeler kısa (üç, iki ve bir bağlantı).
    -->
    <footer class="border-t border-ink-200 bg-surface">
      <div class="mx-auto max-w-7xl px-4 py-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
          <div class="md:max-w-xs">
            <BrandLogo :size="26" />
            <p class="mt-1.5 text-sm text-ink-500">Çok satıcılı teknoloji mağazası. Onlarca mağaza, tek sepet.</p>
          </div>

          <div class="grid flex-1 grid-cols-3 gap-x-4 text-xs sm:text-sm md:max-w-xl md:gap-x-10">
            <div>
              <p class="font-semibold text-ink-800">Alışveriş</p>
              <ul class="mt-2 space-y-1.5 text-ink-500">
                <li><RouterLink :to="{ name: 'products' }" class="hover:text-brand-600">Tüm ürünler</RouterLink></li>
                <li><RouterLink :to="{ name: 'stores' }" class="hover:text-brand-600">Mağazalar</RouterLink></li>
                <li><RouterLink :to="{ name: 'cart' }" class="hover:text-brand-600">Sepetim</RouterLink></li>
              </ul>
            </div>
            <div>
              <p class="font-semibold text-ink-800">Yardım</p>
              <ul class="mt-2 space-y-1.5 text-ink-500">
                <li><RouterLink :to="{ name: 'track' }" class="hover:text-brand-600">Sipariş takibi</RouterLink></li>
                <li><RouterLink :to="{ name: 'support' }" class="hover:text-brand-600">Destek talebi</RouterLink></li>
              </ul>
            </div>
            <div>
              <p class="font-semibold text-ink-800">Satıcı</p>
              <ul class="mt-2 space-y-1.5 text-ink-500">
                <li>
                  <RouterLink :to="{ name: 'account-store-application' }" class="hover:text-brand-600">
                    Mağaza aç
                  </RouterLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <p class="border-t border-ink-200 px-4 py-3 text-center text-xs text-ink-400">
        Donanex — demo ortamı. Ödemeler benzetimdir, gerçek para hareketi olmaz.
      </p>
    </footer>
  </div>
</template>
