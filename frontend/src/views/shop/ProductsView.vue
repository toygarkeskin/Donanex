<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, query } from "../../lib/api";
import ProductCard from "../../components/ProductCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import PageHeader from "../../components/PageHeader.vue";

const route = useRoute();
const router = useRouter();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const categories = ref([]);
const stores = ref([]);
const loading = ref(true);

// Filtreler adres çubuğunda yaşar: sayfa paylaşılabilir ve geri tuşu çalışır.
const filters = reactive({
  q: route.query.ara || "",
  category: route.query.kategori || "",
  store: route.query.magaza || "",
  minPrice: route.query.min || "",
  maxPrice: route.query.max || "",
  inStock: route.query.stokta === "true",
  sort: route.query.sirala || "newest",
  page: Number(route.query.sayfa) || 1
});

const SORTS = [
  { value: "newest", label: "En yeniler" },
  { value: "price_asc", label: "Fiyat: artan" },
  { value: "price_desc", label: "Fiyat: azalan" },
  { value: "name_asc", label: "İsme göre" }
];

function syncUrl() {
  router.replace({
    query: {
      ...(filters.q ? { ara: filters.q } : {}),
      ...(filters.category ? { kategori: filters.category } : {}),
      ...(filters.store ? { magaza: filters.store } : {}),
      ...(filters.minPrice ? { min: filters.minPrice } : {}),
      ...(filters.maxPrice ? { max: filters.maxPrice } : {}),
      ...(filters.inStock ? { stokta: "true" } : {}),
      ...(filters.sort !== "newest" ? { sirala: filters.sort } : {}),
      ...(filters.page > 1 ? { sayfa: String(filters.page) } : {})
    }
  });
}

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(
      `/products${query({
        q: filters.q,
        category: filters.category,
        store: filters.store,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        inStock: filters.inStock ? "true" : "",
        sort: filters.sort,
        page: filters.page,
        pageSize: 24
      })}`
    );
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(filters, { q: "", category: "", store: "", minPrice: "", maxPrice: "", inStock: false, sort: "newest", page: 1 });
}

let debounce;
watch(
  () => [filters.q, filters.minPrice, filters.maxPrice],
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.page = 1;
      syncUrl();
      load();
    }, 350);
  }
);

watch(
  () => [filters.category, filters.store, filters.sort, filters.inStock],
  () => {
    filters.page = 1;
    syncUrl();
    load();
  }
);

watch(
  () => filters.page,
  () => {
    syncUrl();
    load();
  }
);

onMounted(async () => {
  const [categoryList, storeList] = await Promise.all([
    api.get("/categories"),
    api.get("/storefront/stores")
  ]);
  categories.value = categoryList.items;
  stores.value = storeList.items;
  await load();
});
</script>

<template>
  <div>
    <PageHeader title="Ürünler" description="Tüm mağazaların ürünleri tek listede." />

    <div class="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside class="card h-fit space-y-4 p-4">
        <div>
          <label for="search" class="field-label">Ara</label>
          <input id="search" v-model="filters.q" type="search" class="field" placeholder="Ürün, marka…" maxlength="100" />
        </div>

        <div>
          <label for="category" class="field-label">Kategori</label>
          <select id="category" v-model="filters.category" class="field">
            <option value="">Tümü</option>
            <option v-for="category in categories" :key="category.id" :value="category.slug">
              {{ category.name }} ({{ category.productCount }})
            </option>
          </select>
        </div>

        <div>
          <label for="store" class="field-label">Mağaza</label>
          <select id="store" v-model="filters.store" class="field">
            <option value="">Tümü</option>
            <option v-for="store in stores" :key="store.id" :value="store.slug">{{ store.name }}</option>
          </select>
        </div>

        <div>
          <span class="field-label">Fiyat aralığı</span>
          <div class="flex items-center gap-2">
            <input v-model="filters.minPrice" type="number" min="0" class="field" placeholder="En az" aria-label="En az fiyat" />
            <span class="text-ink-400">–</span>
            <input v-model="filters.maxPrice" type="number" min="0" class="field" placeholder="En çok" aria-label="En çok fiyat" />
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="filters.inStock" type="checkbox" class="rounded border-ink-300" />
          Yalnızca stokta olanlar
        </label>

        <button type="button" class="btn-secondary w-full" @click="reset">Filtreleri temizle</button>
      </aside>

      <div>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-ink-500">{{ result.total }} ürün bulundu</p>
          <select v-model="filters.sort" class="field w-auto" aria-label="Sıralama">
            <option v-for="option in SORTS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>

        <LoadingBlock v-if="loading" :rows="4" />

        <EmptyState
          v-else-if="!result.items.length"
          title="Aramanıza uygun ürün bulunamadı"
          description="Filtreleri gevşetmeyi ya da farklı bir arama yapmayı deneyin."
          icon="🔍"
        >
          <button type="button" class="btn-secondary" @click="reset">Filtreleri temizle</button>
        </EmptyState>

        <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ProductCard v-for="product in result.items" :key="product.id" :product="product" />
        </div>

        <PaginationBar
          :page="result.page"
          :pages="result.pages"
          :total="result.total"
          unit="ürün"
          @change="(page) => (filters.page = page)"
        />
      </div>
    </div>
  </div>
</template>
