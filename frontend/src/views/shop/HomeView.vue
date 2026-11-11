<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import BrandAvatar from "../../components/BrandAvatar.vue";
import ProductCard from "../../components/ProductCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";

const auth = useAuthStore();
const products = ref([]);
const stores = ref([]);
const brands = ref([]);
const loading = ref(true);

/*
 * Kategoriler artık burada çekilmiyor: başlıktaki şerit onları her sayfada
 * gösteriyor, aynı listeyi ikinci kez istemenin ve ekranın üstünde yer
 * kaplamanın anlamı yok.
 */
onMounted(async () => {
  try {
    const [latest, storeList, brandList] = await Promise.all([
      api.get("/products?pageSize=12"),
      api.get("/storefront/stores?pageSize=4"),
      api.get("/brands")
    ]);
    products.value = latest.items;
    stores.value = storeList.items.slice(0, 4);
    // Ana sayfada en çok ürünü olan sekiz marka; tamamı markalar sayfasında.
    brands.value = [...(brandList.items ?? [])].sort((a, b) => b.productCount - a.productCount).slice(0, 8);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-8">
    <!--
      Tanıtım şeridi bilinçli olarak alçak tutuluyor: ekranın üst yarısını
      metin değil ÜRÜNLER doldurmalı. Önceden bu blok tek başına ~380px
      kaplıyor ve ilk ürün satırı katlamanın altında kalıyordu.
    -->
    <section class="overflow-hidden rounded-2xl bg-night px-6 py-7 text-white sm:px-10">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="max-w-xl">
          <h1 class="text-xl font-bold tracking-tight sm:text-2xl">
            Onlarca mağaza, tek sepet, tek ödeme.
          </h1>
          <p class="mt-1.5 text-sm text-night-muted">
            Gezmek ve sepete eklemek için üye olmanıza gerek yok; kayıt olmadan da sipariş verebilirsiniz.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
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

    <section>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-ink-900">Yeni eklenenler</h2>
        <RouterLink :to="{ name: 'products' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Tümünü gör →
        </RouterLink>
      </div>

      <LoadingBlock v-if="loading" :rows="2" />
      <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProductCard v-for="product in products" :key="product.id" :product="product" />
      </div>
    </section>

    <!--
      Markalar mağazalardan AYRI bir bölüm: mağaza satıcıdır, marka
      üreticidir. Kullanıcı çoğu zaman "Logitech mouse" arar, "Teknoloji
      Deposu'nun mouse'u" değil.
    -->
    <section v-if="brands.length">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-ink-900">Markalar</h2>
        <RouterLink :to="{ name: 'brands' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Tümünü gör →
        </RouterLink>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RouterLink
          v-for="marka in brands"
          :key="marka.id"
          :to="{ name: 'brand', params: { slug: marka.slug } }"
          class="card flex items-center gap-3 p-3 transition hover:shadow-md"
        >
          <BrandAvatar :brand="marka" size="h-11 w-11" />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink-800">{{ marka.name }}</p>
            <p class="text-xs text-ink-500">{{ marka.productCount }} ürün</p>
          </div>
        </RouterLink>
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
