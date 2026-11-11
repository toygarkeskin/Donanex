<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import PageHeader from "../../components/PageHeader.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import BrandAvatar from "../../components/BrandAvatar.vue";

/*
 * Markalar sayfası.
 *
 * Marka MAĞAZADAN farklıdır: mağaza satıcıdır ("Teknoloji Deposu"), marka
 * üreticidir ("MSI"). Aynı markayı birden çok mağaza satabilir. Bu yüzden
 * ikisi ayrı sayfalar.
 *
 * Sunucu yalnızca VİTRİNDE ürünü olan markaları döndürüyor; boş bir marka
 * sayfasına götüren kart, kullanıcıya verilmiş boş bir sözdür.
 */
const markalar = ref([]);
const yukleniyor = ref(true);

onMounted(async () => {
  try {
    markalar.value = (await api.get("/brands")).items ?? [];
  } finally {
    yukleniyor.value = false;
  }
});
</script>

<template>
  <div>
    <PageHeader title="Markalar" description="Katalogdaki markalar ve ürün sayıları." />

    <LoadingBlock v-if="yukleniyor" :rows="3" />

    <EmptyState
      v-else-if="!markalar.length"
      title="Henüz marka yok"
      description="Ürünlere marka atandıkça burada görünecekler."
      icon="🏷️"
    />

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <RouterLink
        v-for="marka in markalar"
        :key="marka.id"
        :to="{ name: 'brand', params: { slug: marka.slug } }"
        class="card flex items-center gap-3 p-3 transition hover:shadow-md"
      >
        <BrandAvatar :brand="marka" size="h-12 w-12" />
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink-800">{{ marka.name }}</p>
          <p class="text-xs text-ink-500">{{ marka.productCount }} ürün</p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
