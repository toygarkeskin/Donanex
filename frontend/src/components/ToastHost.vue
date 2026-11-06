<script setup>
import { useToastStore } from "../stores/toast";

const toasts = useToastStore();

const tones = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-brand-200 bg-brand-50 text-brand-700"
};
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
    <TransitionGroup
      enter-active-class="transition duration-200"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts.items"
        :key="toast.id"
        role="status"
        class="bildirim pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
        :class="tones[toast.tone] || tones.info"
      >
        <span class="flex-1">{{ toast.message }}</span>
        <button type="button" class="opacity-60 hover:opacity-100" aria-label="Kapat" @click="toasts.dismiss(toast.id)">
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
