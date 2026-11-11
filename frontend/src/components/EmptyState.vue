<script setup>
import AppIcon from "./AppIcon.vue";

/*
 * Boş durum kutusu.
 *
 * Simge eskiden emojiydi (📭 📦 🏪). AppIcon'un kendi gerekçesi burada da
 * geçerliydi: emoji her işletim sisteminde başka çiziliyor ve renk almıyor,
 * yani gri bir kutunun ortasında rengarenk duruyordu. Artık çizim tema
 * rengini alıyor ve kutuyla aynı dili konuşuyor.
 */
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  /** AppIcon adı. */
  icon: { type: String, default: "bos" }
});
</script>

<template>
  <div class="card flex flex-col items-center gap-2 px-6 py-14 text-center">
    <span class="flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-400" aria-hidden="true">
      <AppIcon :name="icon" :size="24" />
    </span>
    <h3 class="text-base font-semibold text-ink-800">{{ title }}</h3>
    <p v-if="description" class="max-w-md text-sm text-ink-500">{{ description }}</p>
    <div class="mt-2"><slot /></div>
  </div>
</template>
