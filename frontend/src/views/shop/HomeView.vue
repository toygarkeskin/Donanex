<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import ProductCard from "../../components/ProductCard.vue";
import ProductImage from "../../components/ProductImage.vue";
import BrandAvatar from "../../components/BrandAvatar.vue";
import YataySerit from "../../components/YataySerit.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";

const auth = useAuthStore();
const products = ref([]);
const stores = ref([]);
const categories = ref([]);
const brands = ref([]);
const loading = ref(true);

/*
 * Ana sayfa bir LİSTE DEĞİL, bir giriş kapısı.
 *
 * Eskiden burada 12 ürünlük bir ızgara vardı ve ürünler sayfasında da aynı
 * kart, aynı ızgara duruyordu; iki sayfa birbirinden ayırt edilemiyordu.
 * Artık ana sayfa "nereye gitmek istiyorsun?" sorusunu soruyor:
 * kategoriler, markalar, mağazalar. Ürün satırı kaldı ama KISA — sayfanın
 * tamamı değil, bir parçası.
 */
onMounted(async () => {
  try {
    const [latest, storeList, categoryList, brandList] = await Promise.all([
      api.get("/products?pageSize=6"),
      api.get("/storefront/stores?pageSize=4"),
      api.get("/categories"),
      api.get("/brands")
    ]);
    products.value = latest.items;
    stores.value = storeList.items.slice(0, 4);
    // Ürünü olmayan kategori gösterilmiyor: boş bir listeye götüren kutu,
    // kullanıcıya verilmiş boş bir sözdür.
    categories.value = (categoryList.items ?? []).filter((k) => k.productCount > 0);
    brands.value = [...(brandList.items ?? [])].sort((a, b) => b.productCount - a.productCount);
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

    <!--
      Kategoriler ana sayfanın ASIL içeriği.

      Kutunun görseli o kategorideki en yeni ürünün fotoğrafı: gerçek
      katalog verisi, bakımı olan ayrı bir "kategori görseli" alanı değil.
      Ürünü olmayan kategori hiç çizilmiyor.
    -->
    <section v-if="categories.length">
      <h2 class="mb-4 text-lg font-bold text-ink-900">Ne arıyorsunuz?</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <RouterLink
          v-for="kategori in categories"
          :key="kategori.id"
          :to="{ name: 'products', query: { kategori: kategori.slug } }"
          class="card group overflow-hidden transition hover:shadow-md"
        >
          <div class="aspect-[4/3] overflow-hidden transition group-hover:scale-105">
            <ProductImage v-if="kategori.imageUrl" :src="kategori.imageUrl" alt="" padding="p-3" />
            <div v-else class="h-full w-full bg-ink-100" />
          </div>
          <div class="p-3">
            <p class="truncate text-sm font-semibold text-ink-800">{{ kategori.name }}</p>
            <p class="text-xs text-ink-500">{{ kategori.productCount }} ürün</p>
          </div>
        </RouterLink>
      </div>
    </section>

    <!--
      Markalar: 17 markanın logosu var, yatay bir şerit olarak ana sayfaya
      ürün ızgarası koymadan hareket katıyor. Mağazadan farklı bir eksen —
      kullanıcı çoğu zaman "Logitech mouse" arar.
    -->
    <!--
      Oklar başlık satırında: şeridin üstünde yüzen düğmeler son kartı
      kapatıyordu. Kaydığı ayrıca kenar solması ve yarım görünen kartla
      belli oluyor — telefonda parmakla kaydırmak zaten doğal yol.
    -->
    <section v-if="brands.length">
      <YataySerit etiket="Markalar" baslik="Markalar" class="pb-2">
        <RouterLink
          v-for="marka in brands"
          :key="marka.id"
          :to="{ name: 'brand', params: { slug: marka.slug } }"
          class="card flex w-28 shrink-0 flex-col items-center gap-2 p-3 transition hover:shadow-md"
        >
          <BrandAvatar :brand="marka" size="h-12 w-12" />
          <p class="w-full truncate text-center text-xs font-medium text-ink-700">{{ marka.name }}</p>
        </RouterLink>
      </YataySerit>
    </section>

    <!--
      Ürün satırı KISA (6 ürün) ve sayfanın sonlarında. Ana sayfanın
      tamamını ürün ızgarası kaplasaydı ürünler sayfasından farkı kalmazdı.
    -->
    <section>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold text-ink-900">Yeni eklenenler</h2>
        <RouterLink :to="{ name: 'products' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Tümünü gör →
        </RouterLink>
      </div>

      <LoadingBlock v-if="loading" :rows="2" />
      <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
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
