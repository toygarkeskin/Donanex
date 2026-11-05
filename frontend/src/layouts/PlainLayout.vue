<script setup>
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-ink-100">
    <header class="px-4 py-6">
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 text-lg font-bold text-ink-900">
        <span aria-hidden="true">🛒</span> Pazar
      </RouterLink>
    </header>

    <main class="flex flex-1 items-start justify-center px-4 pb-12">
      <div class="w-full max-w-md">
        <RouterView />
      </div>
    </main>

    <footer class="px-4 py-6 text-center text-xs text-ink-400">
      Pazar — demo ortamı. Giden e-postalar Mailpit arayüzünde görünür.
    </footer>
  </div>
</template>
