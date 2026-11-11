<script setup>
import { ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";

/*
 * Filtre panelindeki açılır kapanır bölüm.
 *
 * Önce bütün gruplar (kategori, marka, mağaza, fiyat) aynı anda açıktı.
 * Panel uzadıkça uzuyor, telefonda son filtreye ulaşmak için bütün
 * listeleri geçmek gerekiyordu.
 *
 * Varsayılan kapalı, ama İKİ DURUMDA kendiliğinden açılıyor:
 *   - O grupta seçili bir filtre varsa. Kapalı bir başlığın ardında
 *     görünmeyen bir filtrenin listeyi daraltması, kullanıcıyı "ürünler
 *     nereye gitti?" diye bırakır.
 *   - varsayilanAcik verilmişse (kategori: en çok kullanılan grup).
 *
 * Başlıktaki sayı, kapalıyken bile o grupta kaç seçim olduğunu söylüyor.
 */
const props = defineProps({
  baslik: { type: String, required: true },
  /** Bu gruptaki seçili filtre sayısı; 0 ise rozet çizilmez. */
  secili: { type: Number, default: 0 },
  varsayilanAcik: { type: Boolean, default: false }
});

const acik = ref(props.varsayilanAcik || props.secili > 0);

// Dışarıdan (adres çubuğundan, rozet kaldırmadan) seçim gelirse bölüm açılır.
watch(
  () => props.secili,
  (yeni) => {
    if (yeni > 0) acik.value = true;
  }
);
</script>

<template>
  <div class="border-b border-ink-200 pb-3 last:border-b-0 last:pb-0">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 py-2 text-left"
      :aria-expanded="acik"
      @click="acik = !acik"
    >
      <span class="flex items-center gap-2 text-sm font-semibold text-ink-800">
        {{ baslik }}
        <span
          v-if="secili"
          class="rounded-full bg-brand-600 px-1.5 text-xs font-bold leading-5 text-white"
        >
          {{ secili }}
        </span>
      </span>
      <!-- Ok kapalıyken aşağı, açıkken yukarı bakıyor: durum tek bakışta belli. -->
      <span class="shrink-0 text-ink-400 transition-transform" :class="acik ? 'rotate-180' : ''">
        <AppIcon name="asagi" :size="16" />
      </span>
    </button>

    <div v-show="acik" class="pt-1">
      <slot />
    </div>
  </div>
</template>
