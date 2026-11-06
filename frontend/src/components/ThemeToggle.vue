<script setup>
import { useThemeStore } from "../stores/theme";

const tema = useThemeStore();
</script>

<template>
  <button
    type="button"
    class="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
    :aria-pressed="tema.koyuMu"
    :title="tema.etiket"
    @click="tema.degistir()"
  >
    <!-- İki ikon da yerinde durur, biri döner-solar: düğme genişliği
         tema değişince oynamasın diye. -->
    <svg
      class="absolute h-5 w-5 transition-all duration-300"
      :class="tema.koyuMu ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>

    <svg
      class="absolute h-5 w-5 transition-all duration-300"
      :class="tema.koyuMu ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>

    <span class="sr-only">{{ tema.etiket }}</span>
  </button>
</template>
