<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: "" },
  confirmLabel: { type: String, default: "Onayla" },
  tone: { type: String, default: "danger" },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits(["confirm", "cancel"]);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex items-center justify-center bg-night/40 p-4"
      role="dialog"
      aria-modal="true"
      @click.self="emit('cancel')"
    >
      <div class="card w-full max-w-md p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-ink-900">{{ title }}</h2>
        <p v-if="message" class="mt-2 text-sm text-ink-600">{{ message }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn-secondary" :disabled="busy" @click="emit('cancel')">Vazgeç</button>
          <button
            type="button"
            :class="tone === 'danger' ? 'btn-danger' : 'btn-primary'"
            :disabled="busy"
            @click="emit('confirm')"
          >
            {{ busy ? "İşleniyor…" : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
