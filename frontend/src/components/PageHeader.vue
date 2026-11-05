<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" }
});
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-ink-500">{{ description }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
  </header>
</template>
