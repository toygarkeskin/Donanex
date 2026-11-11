<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";

/*
 * Yatay kayan şerit.
 *
 * Üç ayrı sorunu birden çözüyor:
 *
 * 1. DEVAMI OLDUĞU BELLİ DEĞİL. Kaydırma çubuğu gizli, farede tekerlek
 *    yatay kaydırmıyor. Çare: kenarda solma + son kartın yarım görünmesi.
 *    Yarım kalan kart, "burada bitmedi"yi en iyi anlatan şey.
 *
 * 2. OK DÜĞMESİ İÇERİĞİN ÜSTÜNE BİNİYOR. Eskiden şeridin üzerinde yüzen
 *    yuvarlak düğmelerdi ve son kartı kapatıyorlardı. Artık başlık satırına
 *    taşındılar: hiçbir şeyin üstüne binmiyorlar. Başlığı olmayan şeritte
 *    (kategori filtresi) yalnızca GENİŞ ekranda ve küçük boyutta çiziliyor;
 *    telefonda parmakla kaydırmak zaten doğal yol.
 *
 * 3. KARTLAR YARIDA KESİLİYOR. scroll-snap ile her durakta kart kenarı
 *    hizalanıyor. "proximity" seçildi, "mandatory" değil: zorunlu olan,
 *    kullanıcı az kaydırdığında onu geri fırlatıp sinir bozuyor.
 */
defineProps({
  /** Ekran okuyucuda şeridin ne olduğu. */
  etiket: { type: String, required: true },
  /** Başlık verilirse oklar bu satıra konur, içeriğin üstüne binmez. */
  baslik: { type: String, default: "" },
  bosluk: { type: String, default: "gap-3" }
});

const serit = ref(null);
const solVar = ref(false);
const sagVar = ref(false);
let gozcu = null;

function durumuGuncelle() {
  const el = serit.value;
  if (!el) return;
  // 2px tolerans: tarayıcı kesirli piksel döndürdüğü için sona gelindiğinde
  // bile tam eşitlik sağlanmıyor, ok sönmeden kalıyordu.
  solVar.value = el.scrollLeft > 2;
  sagVar.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
}

/** Görünen genişliğin %80'i: kenardaki kart yarım kalmasın, bağlam kopmasın. */
function kaydir(yon) {
  const el = serit.value;
  if (!el) return;
  el.scrollBy({ left: yon * el.clientWidth * 0.8, behavior: "smooth" });
}

onMounted(() => {
  durumuGuncelle();
  window.addEventListener("resize", durumuGuncelle);
  // İçerik API'den sonradan gelince genişlik değişir ama pencere değişmez;
  // resize olayı bunu görmez, ResizeObserver görür.
  if (typeof ResizeObserver !== "undefined" && serit.value) {
    gozcu = new ResizeObserver(durumuGuncelle);
    gozcu.observe(serit.value);
    for (const cocuk of serit.value.children) gozcu.observe(cocuk);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", durumuGuncelle);
  gozcu?.disconnect();
});
</script>

<template>
  <div>
    <!-- Başlık satırı: oklar burada, içeriğin üstünde değil. -->
    <div v-if="baslik" class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-lg font-bold text-ink-900">{{ baslik }}</h2>
      <div v-if="solVar || sagVar" class="flex shrink-0 gap-1">
        <button
          type="button"
          class="rounded-full border border-ink-200 p-1.5 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 disabled:cursor-default disabled:opacity-35"
          :disabled="!solVar"
          :aria-label="`${etiket}: sola kaydır`"
          @click="kaydir(-1)"
        >
          <AppIcon name="sol" :size="16" />
        </button>
        <button
          type="button"
          class="rounded-full border border-ink-200 p-1.5 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 disabled:cursor-default disabled:opacity-35"
          :disabled="!sagVar"
          :aria-label="`${etiket}: sağa kaydır`"
          @click="kaydir(1)"
        >
          <AppIcon name="sag" :size="16" />
        </button>
      </div>
    </div>

    <div class="relative">
      <!--
        Kenar solması: altındaki içeriği saydamlaştırır, tıklamayı engellemez.
        Ok düğmesine bakmayan göz "devamı var"ı buradan yakalıyor.
      -->
      <div
        v-if="solVar"
        class="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-surface to-transparent"
        aria-hidden="true"
      />
      <div
        v-if="sagVar"
        class="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface to-transparent"
        aria-hidden="true"
      />

      <!-- Başlığı olmayan şeritte oklar: yalnızca geniş ekranda, küçük boy. -->
      <template v-if="!baslik">
        <button
          v-if="solVar"
          type="button"
          class="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-ink-200 bg-surface p-1 text-ink-600 shadow-sm hover:bg-ink-100 sm:block"
          :aria-label="`${etiket}: sola kaydır`"
          @click="kaydir(-1)"
        >
          <AppIcon name="sol" :size="14" />
        </button>
        <button
          v-if="sagVar"
          type="button"
          class="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-ink-200 bg-surface p-1 text-ink-600 shadow-sm hover:bg-ink-100 sm:block"
          :aria-label="`${etiket}: sağa kaydır`"
          @click="kaydir(1)"
        >
          <AppIcon name="sag" :size="14" />
        </button>
      </template>

      <div
        ref="serit"
        class="flex snap-x snap-proximity overflow-x-auto scroll-smooth [&>*]:snap-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        :class="bosluk"
        @scroll="durumuGuncelle"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
