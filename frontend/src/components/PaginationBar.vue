<script setup>
const props = defineProps({
  page: { type: Number, default: 1 },
  pages: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  unit: { type: String, default: "kayıt" }
});
const emit = defineEmits(["change"]);

const go = (next) => {
  if (next >= 1 && next <= props.pages && next !== props.page) emit("change", next);
};
</script>

<template>
  <nav v-if="total > 0" class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Sayfalama">
    <p class="text-ink-500">{{ total }} {{ unit }} · sayfa {{ page }} / {{ pages }}</p>
    <div class="flex gap-2">
      <button type="button" class="btn-secondary" :disabled="page <= 1" @click="go(page - 1)">← Önceki</button>
      <button type="button" class="btn-secondary" :disabled="page >= pages" @click="go(page + 1)">Sonraki →</button>
    </div>
  </nav>
</template>
