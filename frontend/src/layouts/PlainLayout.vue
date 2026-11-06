<script setup>
import BrandLogo from "../components/BrandLogo.vue";
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-ink-100">
    <header class="px-4 py-6">
      <RouterLink :to="{ name: 'home' }" aria-label="Donanex ana sayfa">
        <BrandLogo />
      </RouterLink>
    </header>

    <main class="flex flex-1 items-start justify-center px-4 pb-12">
      <div class="w-full max-w-md">
        <RouterView />
      </div>
    </main>

    <footer class="px-4 py-6 text-center text-xs text-ink-400">
      Donanex — demo ortamı. Giden e-postalar Mailpit arayüzünde görünür.
    </footer>
  </div>
</template>
