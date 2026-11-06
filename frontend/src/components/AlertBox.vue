<script setup>
defineProps({
  tone: { type: String, default: "info" },
  title: { type: String, default: "" }
});

const tones = {
  info: "border-brand-200 bg-brand-50 text-brand-700",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900"
};
</script>

<template>
  <div class="alert rounded-lg border px-4 py-3 text-sm" :class="tones[tone] || tones.info" role="status">
    <p v-if="title" class="font-semibold">{{ title }}</p>
    <div :class="title ? 'mt-1' : ''"><slot /></div>
  </div>
</template>
