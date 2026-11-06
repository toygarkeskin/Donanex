<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import ProductCard from "../../components/ProductCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";

const auth = useAuthStore();
const products = ref([]);
const categories = ref([]);
const stores = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [latest, categoryList, storeList] = await Promise.all([
      api.get("/products?pageSize=8"),
      api.get("/categories"),
      api.get("/storefront/stores?pageSize=4")
    ]);
    products.value = latest.items;
    categories.value = categoryList.items.filter((category) => category.productCount > 0);
    stores.value = storeList.items.slice(0, 4);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-12">
    <section class="overflow-hidden rounded-2xl bg-night px-6 py-14 text-white sm:px-12">
      <div class="max-w-2xl">
        <p class="text-sm font-medium text-night-accent">Çok satıcılı teknoloji mağazası</p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Onlarca mağaza, tek sepet, tek ödeme.
        </h1>
        <p class="mt-4 text-night-muted">
          Ürünleri gezmek ve sepete eklemek için üye olmanıza gerek yok. İsterseniz kayıt olmadan da
          sipariş verebilirsiniz.
        </p>
        <div class="mt-7 flex flex-wrap gap-3">
          <RouterLink :to="{ name: 'products' }" class="btn bg-white px-5 py-2.5 text-night hover:bg-white/90">
            Ürünleri keşfet
          </RouterLink>
          <RouterLink
            v-if="!auth.isSignedIn"
            :to="{ name: 'register' }"
            class="btn border border-white/30 px-5 py-2.5 text-white hover:bg-white/10"
          >
            Hesap oluştur
          </RouterLink>
          <RouterLink
            v-else-if="!auth.hasStorePanel"
            :to="{ name: 'account-store-application' }"
            class="btn border border-white/30 px-5 py-2.5 text-white hover:bg-white/10"
          >
            Mağazanı aç
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-if="categories.length">
      <h2 class="mb-4 text-lg font-bold text-ink-900">Kategoriler</h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="category in categories"
          :key="category.id"
          :to="{ name: 'products', query: { kategori: category.slug } }"
          class="card px-4 py-2 text-sm font-medium text-ink-700 transition hover:border-brand-500 hover:text-brand-700"
        >
          {{ category.name }}
          <span class="ml-1 text-ink-400">{{ category.productCount }}</span>
        </RouterLink>
      </div>
    </section>

    <section>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-ink-900">Yeni eklenenler</h2>
        <RouterLink :to="{ name: 'products' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Tümünü gör →
        </RouterLink>
      </div>

      <LoadingBlock v-if="loading" :rows="2" />
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCard v-for="product in products" :key="product.id" :product="product" />
      </div>
    </section>

    <section v-if="stores.length">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-ink-900">Mağazalar</h2>
        <RouterLink :to="{ name: 'stores' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Tümünü gör →
        </RouterLink>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RouterLink
          v-for="store in stores"
          :key="store.id"
          :to="{ name: 'store', params: { slug: store.slug } }"
          class="card flex items-center gap-3 p-4 transition hover:shadow-md"
        >
          <img
            v-if="store.logoUrl"
            :src="store.logoUrl"
            :alt="store.name"
            class="h-12 w-12 rounded-lg object-contain"
            loading="lazy"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink-800">{{ store.name }}</p>
            <p class="text-xs text-ink-500">{{ store.productCount }} ürün</p>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
