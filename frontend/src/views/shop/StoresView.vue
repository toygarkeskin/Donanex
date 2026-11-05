<script setup>
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { api, query } from "../../lib/api";
import PageHeader from "../../components/PageHeader.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";

const stores = ref([]);
const search = ref("");
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const result = await api.get(`/storefront/stores${query({ q: search.value })}`);
    stores.value = result.items;
  } finally {
    loading.value = false;
  }
}

let debounce;
watch(search, () => {
  clearTimeout(debounce);
  debounce = setTimeout(load, 350);
});

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Mağazalar" description="Pazar'da satış yapan onaylı mağazalar." />

    <div class="mb-6 max-w-md">
      <label for="store-search" class="sr-only">Mağaza ara</label>
      <input id="store-search" v-model="search" type="search" class="field" placeholder="Mağaza ara…" maxlength="100" />
    </div>

    <LoadingBlock v-if="loading" :rows="3" />

    <EmptyState v-else-if="!stores.length" title="Mağaza bulunamadı" icon="🏪" />

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="store in stores"
        :key="store.id"
        :to="{ name: 'store', params: { slug: store.slug } }"
        class="card flex gap-4 p-5 transition hover:shadow-md"
      >
        <img
          v-if="store.logoUrl"
          :src="store.logoUrl"
          :alt="store.name"
          class="h-14 w-14 shrink-0 rounded-lg object-contain"
          loading="lazy"
        />
        <div class="min-w-0">
          <p class="font-semibold text-ink-900">{{ store.name }}</p>
          <p class="mt-1 line-clamp-2 text-sm text-ink-500">{{ store.description }}</p>
          <p class="mt-2 text-xs font-medium text-brand-600">{{ store.productCount }} ürün</p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
