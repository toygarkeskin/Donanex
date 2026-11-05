<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: "—" },
  hint: { type: String, default: "" },
  tone: { type: String, default: "neutral" }
});

const tones = {
  neutral: "text-ink-900",
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700"
};
</script>

<template>
  <article class="card p-4">
    <p class="text-xs font-medium uppercase tracking-wide text-ink-500">{{ label }}</p>
    <p class="mt-2 text-2xl font-bold" :class="tones[tone] || tones.neutral">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-ink-500">{{ hint }}</p>
  </article>
</template>
