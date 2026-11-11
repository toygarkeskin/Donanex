<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "./AppIcon.vue";

/*
 * Telefon ve tablette "geri" tuşu.
 *
 * Masaüstünde gerek yok: orada hem tarayıcının geri tuşu göz hizasında
 * duruyor hem de üst menü her sayfaya bir tıkla götürüyor. Telefonda ise
 * tarayıcı çubuğu kaydırırken gizlenebiliyor ve kullanıcı ürün sayfasının
 * içinde kalıyor; Android'de donanım tuşu var ama iOS'ta yok.
 *
 * KÖK sayfalarda ÇİZİLMİYOR. Ana sayfa, ürünler, mağazalar ve sepet üst
 * menüden tek tıkla açılıyor; oraya "geri" koymak kullanıcıyı sitenin
 * dışına, geldiği arama sonucuna atardı.
 *
 * Geçmiş yoksa (bağlantıyla doğrudan ürün sayfasına girilmişse)
 * router.back() kullanıcıyı siteden çıkarırdı; o yüzden geçmiş yokken
 * ana sayfaya gidiyor.
 */
const route = useRoute();
const router = useRouter();

/*
 * Üst menüden ya da panelin kenar menüsünden zaten tek tıkla açılan
 * sayfalar. Panelin gösterge sayfaları da burada: kenar menü açıldığında
 * oraya dönmek bir tıklık, "geri" ise kullanıcıyı mağaza panelinden
 * tamamen çıkarabilir.
 */
const KOK_SAYFALAR = ["home", "products", "stores", "cart", "store-dashboard", "admin-dashboard"];

const gorunur = computed(() => !KOK_SAYFALAR.includes(String(route.name)));

/** Tarayıcı geçmişinde bu siteye ait bir önceki adım var mı. */
const gecmisVar = () => Boolean(window.history.state && window.history.state.back);

function geri() {
  if (gecmisVar()) router.back();
  else router.push({ name: "home" });
}
</script>

<template>
  <!--
    lg:hidden — kırılma noktası menüdeki hamburgerle AYNI: hamburger
    göründüğü her yerde bu tuş da görünüyor, ikisi birden kaybolunca
    masaüstü menüsü devralıyor.
  -->
  <div v-if="gorunur" class="mx-auto w-full max-w-7xl px-4 pt-3 lg:hidden">
    <button
      type="button"
      class="-ml-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-sm font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
      @click="geri"
    >
      <AppIcon name="sol" :size="18" />
      Geri
    </button>
  </div>
</template>
