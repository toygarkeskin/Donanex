<script setup>
import { RouterLink, RouterView } from "vue-router";
import BrandLogo from "../components/BrandLogo.vue";
import AppIcon from "../components/AppIcon.vue";

/*
 * Giriş, kayıt ve parola sayfalarının düzeni.
 *
 * Önce düz gri bir zemin ve ortada bir kutu vardı; sitenin geri kalanıyla
 * hiçbir bağı yoktu. Artık iki parçalı: solda (telefonda üstte) koyu marka
 * paneli, sağda form.
 *
 * Arka plan DIŞ GÖRSEL DEĞİL, CSS'ten çizilen bir nokta ızgarası — çip
 * ayağı motifinin soyutlaması. Fotoğraf koymak için ya stok görsel indirmek
 * ya da uydurmak gerekirdi; ikisi de sayfayı ağırlaştırır ve markayla ilgisi
 * olmayan bir resim koyardı.
 *
 * Panel TELEFONDA KISA: oradaki iş giriş yapmak, tanıtım okumak değil.
 * Maddeler yalnızca geniş ekranda, yerin bol olduğu yerde çiziliyor.
 */
const maddeler = [
  { icon: "sepet", metin: "Üye olmadan da sipariş verebilirsiniz" },
  { icon: "magaza", metin: "Onlarca mağaza, tek sepet, tek ödeme" },
  { icon: "kargo", metin: "Siparişinizi takip koduyla izleyin" }
];
</script>

<template>
  <div class="min-h-screen bg-ink-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <aside class="relative overflow-hidden bg-night px-5 py-6 text-white lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-12">
      <!--
        Nokta ızgarası: tek bir CSS gradyanı, tekrarlıyor. Ağ isteği yok,
        her ölçekte keskin, koyu zeminde markanın mavisini taşıyor.
      -->
      <div
        class="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style="
          background-image: radial-gradient(circle, rgba(59, 110, 240, 0.35) 1px, transparent 1px);
          background-size: 22px 22px;
        "
      />

      <div class="relative">
        <RouterLink :to="{ name: 'home' }" aria-label="Donanex ana sayfa" class="inline-flex">
          <BrandLogo />
        </RouterLink>

        <h2 class="mt-5 text-xl font-bold leading-snug lg:mt-10 lg:text-3xl">
          Onlarca mağaza,<br class="hidden lg:block" />
          tek sepet, tek ödeme.
        </h2>
      </div>

      <ul class="relative mt-8 hidden space-y-4 lg:block">
        <li v-for="madde in maddeler" :key="madde.metin" class="flex items-start gap-3 text-sm text-night-muted">
          <span class="mt-0.5 shrink-0 text-night-accent"><AppIcon :name="madde.icon" :size="18" /></span>
          {{ madde.metin }}
        </li>
      </ul>
    </aside>

    <main class="flex items-center justify-center px-4 py-8 lg:px-8">
      <!--
        Kutu BURADA ÇİZİLMİYOR: giriş, kayıt, parola sayfalarının her biri
        zaten kendi "card" kutusunu çiziyor. İkisi birden olunca iç içe iki
        çerçeve çıkıyordu.
      -->
      <div class="w-full max-w-md">
        <RouterView />

        <p class="mt-5 text-center text-xs text-ink-400">
          Donanex — demo ortamı. Giden e-postalar Mailpit arayüzünde görünür.
        </p>
      </div>
    </main>
  </div>
</template>
