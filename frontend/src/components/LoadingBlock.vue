<script setup>
defineProps({ rows: { type: Number, default: 3 }, label: { type: String, default: "Yükleniyor…" } });
</script>

<template>
  <div class="space-y-3" role="status" :aria-label="label">
    <div v-for="row in rows" :key="row" class="h-14 animate-pulse rounded-xl bg-ink-100" />
  </div>
</template>
