<script setup>
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api, query } from "../../lib/api";
import ProductCard from "../../components/ProductCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import { sayfayiTanimla } from "../../lib/sayfaBilgisi";

const route = useRoute();
const store = ref(null);
const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const notFound = ref(false);
const page = ref(1);

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    store.value = await api.get(`/storefront/stores/${route.params.slug}`);
    sayfayiTanimla(store.value.name, store.value.description);
    result.value = await api.get(`/products${query({ store: route.params.slug, page: page.value, pageSize: 24 })}`);
  } catch {
    notFound.value = true;
    sayfayiTanimla("Mağaza bulunamadı");
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.slug, () => {
  page.value = 1;
  load();
});
watch(page, load);
onMounted(load);
</script>

<template>
  <LoadingBlock v-if="loading && !store" :rows="4" />

  <EmptyState v-else-if="notFound" title="Mağaza bulunamadı" icon="🏪">
    <RouterLink :to="{ name: 'stores' }" class="btn-primary">Mağazalara dön</RouterLink>
  </EmptyState>

  <div v-else>
    <header class="card mb-8 flex flex-wrap items-center gap-5 p-6">
      <img
        v-if="store.logoUrl"
        :src="store.logoUrl"
        :alt="store.name"
        class="h-20 w-20 rounded-xl object-contain"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">{{ store.name }}</h1>
        <p class="mt-1 text-sm text-ink-500">{{ store.description }}</p>
        <p class="mt-2 text-xs font-medium text-brand-600">{{ store.productCount }} ürün satışta</p>
      </div>
    </header>

    <LoadingBlock v-if="loading" :rows="3" />
    <EmptyState v-else-if="!result.items.length" title="Bu mağazada henüz ürün yok" icon="🏷️" />
    <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <ProductCard v-for="product in result.items" :key="product.id" :product="product" />
    </div>

    <PaginationBar
      :page="result.page"
      :pages="result.pages"
      :total="result.total"
      unit="ürün"
      @change="(next) => (page = next)"
    />
  </div>
</template>
