<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  icon: { type: String, default: "📭" }
});
</script>

<template>
  <div class="card flex flex-col items-center gap-2 px-6 py-14 text-center">
    <div class="text-4xl" aria-hidden="true">{{ icon }}</div>
    <h3 class="text-base font-semibold text-ink-800">{{ title }}</h3>
    <p v-if="description" class="max-w-md text-sm text-ink-500">{{ description }}</p>
    <div class="mt-2"><slot /></div>
  </div>
</template>
