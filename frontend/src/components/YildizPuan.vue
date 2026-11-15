<script setup>
import { computed } from "vue";

/*
 * Yıldız gösterimi (salt okunur).
 *
 * Kesirli puan (4,3) yarım yıldıza yuvarlanmıyor, yıldız KISMEN doluyor:
 * 4,3 ile 4,7 aynı görünmesin. Doluluk bir kırpma maskesiyle çiziliyor,
 * böylece tek bir SVG yolu iki renkle boyanabiliyor.
 */
const props = defineProps({
  puan: { type: Number, default: 0 },
  boyut: { type: Number, default: 16 }
});

const yildizlar = computed(() =>
  Array.from({ length: 5 }, (_, i) => Math.round(Math.min(1, Math.max(0, props.puan - i)) * 100))
);
</script>

<template>
  <span class="inline-flex items-center gap-0.5" role="img" :aria-label="`5 üzerinden ${puan.toLocaleString('tr-TR')} puan`">
    <span v-for="(doluluk, i) in yildizlar" :key="i" class="relative inline-block" :style="{ width: `${boyut}px`, height: `${boyut}px` }">
      <svg :width="boyut" :height="boyut" viewBox="0 0 24 24" class="absolute inset-0 text-ink-200" fill="currentColor" aria-hidden="true">
        <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8z" />
      </svg>
      <span class="absolute inset-0 overflow-hidden" :style="{ width: `${doluluk}%` }">
        <svg :width="boyut" :height="boyut" viewBox="0 0 24 24" class="text-amber-400" fill="currentColor" aria-hidden="true">
          <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8z" />
        </svg>
      </span>
    </span>
  </span>
</template>
