<script setup>
import { computed } from "vue";
import { describe } from "../lib/format";

const props = defineProps({
  map: { type: Object, required: true },
  value: { type: String, default: "" }
});

const tones = {
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-brand-50 text-brand-700 ring-brand-200",
  neutral: "bg-ink-100 text-ink-600 ring-ink-200"
};

const state = computed(() => describe(props.map, props.value));
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
    :class="tones[state.tone] || tones.neutral"
  >
    {{ state.label }}
  </span>
</template>
