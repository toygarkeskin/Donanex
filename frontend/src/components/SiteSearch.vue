<script setup>
import AppIcon from "./AppIcon.vue";

/*
 * Arama kutusu.
 *
 * Kendi bileşeni olmasının sebebi YERLEŞİM: telefonda kutu başlığın
 * YAPIŞKAN olmayan kısmında, geniş ekranda ise logoyla aynı satırda
 * durmak zorunda. CSS bir elemanı başka bir ebeveynin içine taşıyamaz,
 * bu yüzden kutu iki yere de yazılıyor — ama mantık tek yerde kalıyor.
 *
 * Değer dışarıda (ShopLayout) tutuluyor; iki kopya aynı değeri gösterir.
 */
defineProps({
  // Aynı sayfada iki kopya olduğu için id'ler çakışmasın diye dışarıdan gelir.
  id: { type: String, required: true },
  modelValue: { type: String, default: "" }
});

const emit = defineEmits(["update:modelValue", "gonder"]);
</script>

<template>
  <form class="flex w-full min-w-0 items-center" role="search" @submit.prevent="emit('gonder')">
    <label :for="id" class="sr-only">Ürün ara</label>
    <div class="relative w-full">
      <input
        :id="id"
        :value="modelValue"
        type="search"
        name="ara"
        placeholder="Ürün, marka veya mağaza ara"
        class="w-full rounded-xl border border-ink-200 bg-ink-50 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
        <AppIcon name="arama" :size="18" />
      </span>
    </div>
  </form>
</template>
