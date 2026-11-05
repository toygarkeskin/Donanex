<script setup>
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
    <p class="text-5xl" aria-hidden="true">🧭</p>
    <h1 class="text-2xl font-bold text-ink-900">Sayfa bulunamadı</h1>
    <p class="max-w-md text-sm text-ink-500">
      Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.
    </p>
    <RouterLink :to="{ name: 'home' }" class="btn-primary">Ana sayfaya dön</RouterLink>
  </div>
</template>
