<script setup>
defineProps({
  label: { type: String, required: true },
  id: { type: String, required: true },
  hint: { type: String, default: "" },
  error: { type: String, default: "" },
  required: { type: Boolean, default: false }
});
</script>

<template>
  <div>
    <label :for="id" class="field-label">
      {{ label }}
      <span v-if="required" class="text-red-600" aria-hidden="true">*</span>
    </label>
    <slot />
    <p v-if="hint && !error" class="mt-1 text-xs text-ink-500">{{ hint }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
