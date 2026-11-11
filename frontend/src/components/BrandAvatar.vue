<script setup>
import { computed } from "vue";
import ProductImage from "./ProductImage.vue";

/*
 * Marka işareti.
 *
 * Logo YÜKLENMEMİŞSE markanın adından tipografik bir karo çiziliyor.
 * Alternatifi, marka logolarını internetten toplayıp koymaktı: logolar
 * tescilli markadır ve başkasının sitesinde kullanımı ayrı bir izne
 * bağlıdır, dolayısıyla okul projesinde bile doğru yol değil. Harf
 * karosu hem her markada aynı biçimde duruyor hem de kimsenin hakkını
 * kullanmıyor. Panelden gerçek logo yüklendiğinde (logoUrl) onun yerini
 * alır.
 */
const props = defineProps({
  brand: { type: Object, required: true },
  size: { type: String, default: "h-16 w-16" }
});

/** En fazla iki harf: "8BitDo" → "8B", "Western Digital" → "WD". */
const harfler = computed(() => {
  const parcalar = (props.brand.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parcalar.length > 1) return (parcalar[0][0] + parcalar[1][0]).toUpperCase();
  return (parcalar[0] ?? "?").slice(0, 2).toUpperCase();
});
</script>

<template>
  <div :class="size" class="shrink-0 overflow-hidden rounded-xl border border-ink-200">
    <ProductImage v-if="brand.logoUrl" :src="brand.logoUrl" :alt="brand.name" padding="p-2" />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-brand-50 font-bold tracking-tight text-brand-700"
    >
      {{ harfler }}
    </div>
  </div>
</template>
