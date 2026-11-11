<script setup>
import BrandLogo from "./BrandLogo.vue";

/*
 * Açılış ekranı.
 *
 * Uygulama açılırken yenileme çerezinden oturum geri alınıyor
 * (auth.restore). Bu bir ağ gidiş-gelişi ve router ilk gezinmeyi o bitene
 * kadar bekletiyor — yani o süre boyunca ekranda HİÇBİR ŞEY yoktu. Telefonda
 * uygulama olarak açıldığında bu, "uygulama açılmadı" gibi görünüyordu.
 *
 * Buradaki ekran o boşluğu dolduruyor: marka işareti, dönen halka ve ne
 * olduğunu söyleyen bir satır. Süreyi kısaltmıyor, ama olup biteni
 * görünür kılıyor.
 *
 * Erişilebilirlik: role="status" + aria-live, ekran okuyucunun durumu
 * duyurması için. Dönen halka prefers-reduced-motion'da durur (style.css).
 */
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-ink-50"
    role="status"
    aria-live="polite"
  >
    <BrandLogo :size="44" />

    <!-- Dönen halka: üst kenarı saydam bir çember, bu yüzden dönüşü görünür. -->
    <span
      class="h-7 w-7 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600"
      aria-hidden="true"
    />

    <p class="text-sm text-ink-500">Oturum açılıyor…</p>
  </div>
</template>
