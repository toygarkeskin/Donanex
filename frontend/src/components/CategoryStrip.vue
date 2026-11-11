<script setup>
import { RouterLink, useRoute } from "vue-router";
import YataySerit from "./YataySerit.vue";

/*
 * Kategori şeridi: ürün listesinin üstündeki hızlı filtre.
 *
 * Kaydırma ipuçları (ok düğmeleri ve kenar solması) YataySerit'te;
 * aynı mantık ana sayfadaki markalar şeridinde de kullanılıyor, iki
 * yerde ayrı ayrı yazılmıyor.
 */
defineProps({
  categories: { type: Array, default: () => [] }
});

const route = useRoute();
</script>

<template>
  <nav v-if="categories.length" class="border-b border-ink-200 bg-surface px-2" aria-label="Kategoriler">
    <YataySerit etiket="Kategoriler" bosluk="gap-1" class="py-1.5">
      <RouterLink
        v-for="kategori in categories"
        :key="kategori.id"
        :to="{ name: 'products', query: { kategori: kategori.slug } }"
        class="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        :class="route.query.kategori === kategori.slug ? 'bg-ink-100 text-ink-900' : ''"
      >
        {{ kategori.name }}
      </RouterLink>
    </YataySerit>
  </nav>
</template>
