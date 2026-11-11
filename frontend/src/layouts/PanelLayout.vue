<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import ThemeToggle from "../components/ThemeToggle.vue";
import BrandLogo from "../components/BrandLogo.vue";
import AppIcon from "../components/AppIcon.vue";
import GeriTusu from "../components/GeriTusu.vue";
import BildirimZili from "../components/BildirimZili.vue";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const sidebarOpen = ref(false);
const hesapAcik = ref(false);
const hesapKutusu = ref(null);

const isAdminPanel = computed(() => route.path.startsWith("/yonetim"));
const storeId = computed(() => route.params.storeId || auth.stores[0]?.id);
const activeStore = computed(() => auth.stores.find((store) => store.id === storeId.value));

/**
 * Menüde hangi bağlantının vurgulanacağı.
 *
 * Vue Router'ın active-class'ı ROTA KAYDI hiyerarşisine bakar, adres metnine
 * değil. Alt sayfalar burada kardeş rota olarak tanımlı (":storeId/urunler" ve
 * ":storeId/urunler/yeni" ayrı kayıtlar), bu yüzden yeni ürün sayfasındayken
 * "Ürünler" vurgulanmıyordu. Eşleştirmeyi adres yolu üzerinden yapıyoruz.
 *
 * tamEslesme olanlar (Genel bakış) yalnızca kendi adreslerinde vurgulanır:
 * panelin kök adresinde durdukları için ön ek eşleşmesinde her sayfada
 * yanıyor ve menüde iki satır birden seçili görünüyordu.
 */
function aktifMi(link) {
  const hedef = router.resolve({ name: link.name, params: link.params }).path;
  if (link.tamEslesme) return route.path === hedef;
  return route.path === hedef || route.path.startsWith(`${hedef}/`);
}

/*
 * Menü bağlantıları.
 *
 * Simgeler artık emoji DEĞİL, AppIcon çizimleri: emoji her işletim sisteminde
 * başka çiziliyor ve renk almıyordu — koyu kenar menüde gri yazının yanında
 * rengarenk duruyorlardı. Aynı gerekçeyle vitrin menüsü de daha önce
 * emojiden çıkarılmıştı.
 */
const adminLinks = [
  { name: "admin-dashboard", label: "Genel bakış", icon: "panel", tamEslesme: true },
  { name: "admin-stores", label: "Mağazalar", icon: "magaza" },
  { name: "admin-users", label: "Kullanıcılar", icon: "kullanicilar" },
  { name: "admin-orders", label: "Siparişler", icon: "kargo" },
  { name: "admin-tickets", label: "Destek", icon: "destek" }
];

const storeLinks = computed(() => {
  const params = { storeId: storeId.value };
  return [
    { name: "store-dashboard", label: "Genel bakış", icon: "panel", params, tamEslesme: true },
    { name: "store-products", label: "Ürünler", icon: "etiket", params },
    { name: "store-orders", label: "Siparişler", icon: "kargo", params },
    { name: "store-tickets", label: "Destek", icon: "destek", params },
    { name: "store-members", label: "Çalışanlar", icon: "kullanicilar", params },
    { name: "store-settings", label: "Ayarlar", icon: "ayarlar", params }
  ];
});

const links = computed(() => (isAdminPanel.value ? adminLinks : storeLinks.value));
const title = computed(() => (isAdminPanel.value ? "Yönetim Paneli" : activeStore.value?.name || "Mağaza Paneli"));

/** Sayfanın kendi başlığı: menüde vurgulu olan bağlantının adı. */
const sayfaBasligi = computed(() => links.value.find((link) => aktifMi(link))?.label ?? "");

/*
 * Panelin bildirim kutusu.
 *
 * Kişisel kutudan AYRI: mağaza panelindeki zil mağazanın kutusunu gösterir,
 * vitrin başlığındaki zil kişinin kendi kutusunu. "Siparişiniz kargoya
 * verildi" ile "yeni sipariş geldi" aynı kutuda karışsaydı, mağaza sahibi
 * müşteri bildirimleri arasında kendi işini kaybederdi.
 *
 * Mağaza henüz belli değilken (panelin kök adresi, yönlendirme bekliyor)
 * kutu yok ve zil çizilmiyor.
 */
const bildirimKutusu = computed(() => {
  if (isAdminPanel.value) return "admin";
  return storeId.value ? `store:${storeId.value}` : null;
});

/** Avatardaki baş harfler: "Elif Kaya" -> "EK". */
const basHarfler = computed(() =>
  (auth.displayName || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parca) => parca[0].toLocaleUpperCase("tr-TR"))
    .join("")
);

function disaridaTiklandi(olay) {
  if (hesapKutusu.value && !hesapKutusu.value.contains(olay.target)) hesapAcik.value = false;
}

function tusaBasildi(olay) {
  if (olay.key !== "Escape") return;
  hesapAcik.value = false;
  sidebarOpen.value = false;
}

onMounted(() => {
  document.addEventListener("click", disaridaTiklandi);
  document.addEventListener("keydown", tusaBasildi);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", disaridaTiklandi);
  document.removeEventListener("keydown", tusaBasildi);
});

// Sayfa değişince açık kalan menüler kapanır.
watch(
  () => route.fullPath,
  () => {
    hesapAcik.value = false;
    sidebarOpen.value = false;
  }
);

async function signOut() {
  hesapAcik.value = false;
  await auth.signOut();
  router.push({ name: "home" });
}
</script>

<template>
  <div class="flex min-h-screen bg-ink-100">
    <!--
      Kenar menü İKİ TEMADA DA KOYU: "night" belirteçlerini kullanıyor.
      Bu belirteçler bilinçli olarak ters çevrilmiyor (bkz. style.css), yani
      açık temada da koyu kalıyor. Sebebi tasarım: koyu kenar menü içeriği
      çerçeveliyor ve gözün ilk gittiği yeri (asıl iş alanı) açık bırakıyor.
      "ink" rampası kullanılsaydı koyu temada beyaza dönerdi.
    -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-white/10 bg-night transition-transform lg:static lg:translate-x-0"
      :class="{ 'translate-x-0': sidebarOpen }"
    >
      <div class="flex h-16 shrink-0 items-center gap-2 px-5">
        <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2" aria-label="Donanex ana sayfa">
          <BrandLogo :size="26" :with-text="false" />
          <span class="text-lg font-bold tracking-tight text-white">Donanex</span>
        </RouterLink>
      </div>

      <div class="px-5 pb-5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-night-muted">
          {{ isAdminPanel ? "Sistem" : "Mağaza" }}
        </p>
        <p class="mt-0.5 truncate text-sm font-semibold text-white">{{ title }}</p>
      </div>

      <!--
        Menü kaydırılabilir, alt bölüm değil: on bağlantı ve iki mağazayla
        400px yüksekliğindeki bir tarayıcıda alttaki "Siteye dön" ekrandan
        taşıyordu. Eskiden alt bölüm "absolute bottom-0" ile sabitliydi ve
        menünün üstüne biniyordu.
      -->
      <nav class="min-h-0 flex-1 overflow-y-auto px-3" aria-label="Panel menüsü">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name, params: link.params }"
          class="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
          :class="
            aktifMi(link)
              ? 'bg-white/10 text-white'
              : 'text-night-muted hover:bg-white/5 hover:text-white'
          "
          active-class=""
          exact-active-class=""
          @click="sidebarOpen = false"
        >
          <!-- Seçili satırın sol kenarındaki şerit: vurgu rengi tek başına
               koyu zeminde yeterince ayırt edilmiyordu. -->
          <span
            v-if="aktifMi(link)"
            class="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-500"
            aria-hidden="true"
          />
          <AppIcon :name="link.icon" :size="19" :class="aktifMi(link) ? 'text-brand-200' : ''" />
          {{ link.label }}
        </RouterLink>

        <div v-if="!isAdminPanel && auth.stores.length > 1" class="mt-6">
          <p class="px-3 text-[11px] font-semibold uppercase tracking-wider text-night-muted">Diğer mağazalarım</p>
          <RouterLink
            v-for="store in auth.stores.filter((s) => s.id !== storeId)"
            :key="store.id"
            :to="{ name: 'store-dashboard', params: { storeId: store.id } }"
            class="mt-1 block truncate rounded-lg px-3 py-2 text-sm text-night-muted hover:bg-white/5 hover:text-white"
            @click="sidebarOpen = false"
          >
            {{ store.name }}
          </RouterLink>
        </div>
      </nav>

      <div class="shrink-0 space-y-1 border-t border-white/10 p-3">
        <RouterLink
          v-if="auth.isSystemAdmin && !isAdminPanel"
          :to="{ name: 'admin-dashboard' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-night-muted hover:bg-white/5 hover:text-white"
        >
          <AppIcon name="ayarlar" :size="17" /> Yönetim paneline geç
        </RouterLink>
        <RouterLink
          v-if="isAdminPanel && auth.hasStorePanel"
          :to="{ name: 'store-panel' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-night-muted hover:bg-white/5 hover:text-white"
        >
          <AppIcon name="magaza" :size="17" /> Mağaza paneline geç
        </RouterLink>
        <RouterLink
          :to="{ name: 'home' }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-night-muted hover:bg-white/5 hover:text-white"
        >
          <AppIcon name="sol" :size="17" /> Siteye dön
        </RouterLink>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-night/50 backdrop-blur-sm lg:hidden" @click="sidebarOpen = false" />

    <div class="flex min-w-0 flex-1 flex-col">
      <!--
        Başlık YAPIŞKAN: uzun listelerde sayfayı aşağı kaydırınca menü düğmesi,
        bildirim zili ve hesap menüsü ekrandan çıkıyordu; telefonda kenar menüyü
        açmak için her seferinde en yukarı dönmek gerekiyordu.

        "relative" değil "sticky" yazıyor ama ikisi de konumlandırılmış sayılır;
        bildirim paneli telefonda BU başlığa göre konumlanıyor.
      -->
      <header
        class="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-ink-200 bg-surface/95 px-4 backdrop-blur lg:px-6"
      >
        <button
          type="button"
          class="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
          aria-label="Menü"
          @click.stop="sidebarOpen = true"
        >
          <AppIcon name="menu" />
        </button>

        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink-900">{{ sayfaBasligi || title }}</p>
          <p v-if="sayfaBasligi" class="truncate text-xs text-ink-500">{{ title }}</p>
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <BildirimZili v-if="bildirimKutusu" :kutu="bildirimKutusu" />
          <ThemeToggle />

          <!--
            Hesap menüsü: çıkış düğmesi doğrudan başlıkta durmuyor artık.
            Kaza riski vardı — telefonda "Çıkış" menü düğmesinin hemen
            yanındaydı ve yanlışlıkla basılması oturumu kapatıyordu.
          -->
          <div ref="hesapKutusu" class="relative">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-ink-100"
              :aria-expanded="hesapAcik"
              aria-label="Hesap menüsü"
              @click="hesapAcik = !hesapAcik"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
                aria-hidden="true"
              >
                {{ basHarfler }}
              </span>
              <AppIcon name="asagi" :size="16" class="text-ink-500" />
            </button>

            <div
              v-if="hesapAcik"
              class="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-surface py-1 shadow-lg"
            >
              <div class="border-b border-ink-200 px-4 py-2">
                <p class="truncate text-sm font-medium text-ink-900">{{ auth.displayName }}</p>
                <p class="truncate text-xs text-ink-500">{{ title }}</p>
              </div>
              <RouterLink :to="{ name: 'account-profile' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Hesap bilgilerim
              </RouterLink>
              <RouterLink :to="{ name: 'home' }" class="block px-4 py-2 text-sm hover:bg-ink-50">
                Siteye dön
              </RouterLink>
              <hr class="my-1 border-ink-200" />
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                @click="signOut"
              >
                <AppIcon name="cikis" :size="16" /> Çıkış yap
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Panelde de geri tuşu: telefonda kenar menü kapalı duruyor,
           sipariş veya ürün ayrıntısından listeye dönmenin tek yolu
           tarayıcının geri tuşu kalıyordu. -->
      <GeriTusu />

      <main class="min-w-0 flex-1 p-4 lg:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
