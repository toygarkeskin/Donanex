<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, query } from "../../lib/api";
import ProductCard from "../../components/ProductCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import PageHeader from "../../components/PageHeader.vue";

const route = useRoute();
const router = useRouter();

/** Dar ekranda filtre panelinin açık olup olmadığı; geniş ekranda kullanılmaz. */
const filtrelerAcik = ref(false);

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const categories = ref([]);
const stores = ref([]);
const loading = ref(true);

/**
 * Adres çubuğundaki çoklu seçimi listeye çevirir.
 *
 * Biçim virgülle ayrılmış: ?kategori=laptop,monitor. Tek değer de geçerlidir —
 * başlıktaki kategori şeridi ve ürün kartları hâlâ tek slug gönderiyor.
 */
function listeyeCevir(deger) {
  if (Array.isArray(deger)) return deger.filter(Boolean);
  return String(deger ?? "")
    .split(",")
    .map((parca) => parca.trim())
    .filter(Boolean);
}

/** Adres çubuğundaki sorguyu filtre nesnesine çevirir. */
function sorgudanFiltreler(sorgu) {
  return {
    q: sorgu.ara || "",
    category: listeyeCevir(sorgu.kategori),
    store: listeyeCevir(sorgu.magaza),
    minPrice: sorgu.min || "",
    maxPrice: sorgu.max || "",
    inStock: sorgu.stokta === "true",
    sort: sorgu.sirala || "newest",
    page: Number(sorgu.sayfa) || 1
  };
}

// Filtreler adres çubuğunda yaşar: sayfa paylaşılabilir ve geri tuşu çalışır.
const filters = reactive(sorgudanFiltreler(route.query));

/**
 * Filtrelerin şu anki hâli, sorgudan okunanla karşılaştırılabilir biçimde.
 *
 * Alan sırası sorgudanFiltreler ile AYNI olmalı: karşılaştırma JSON metni
 * üzerinden yapılıyor, sıra değişirse eşit nesneler farklı görünür.
 */
function filtrelerinOzeti() {
  return {
    q: filters.q,
    category: [...filters.category],
    store: [...filters.store],
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock,
    sort: filters.sort,
    page: filters.page
  };
}

const SORTS = [
  { value: "newest", label: "En yeniler" },
  { value: "price_asc", label: "Fiyat: artan" },
  { value: "price_desc", label: "Fiyat: azalan" },
  { value: "name_asc", label: "İsme göre" }
];

/**
 * Adres çubuğu DIŞARIDAN değiştiğinde (başlıktaki kategori şeridi, tarayıcının
 * geri/ileri tuşu, paylaşılan bir bağlantı) filtreleri yeniden okuruz.
 *
 * Bu bayrak kendi izleyicilerimizi o sırada susturur: aksi halde filtreleri
 * yazmak syncUrl'i, o da bu izleyiciyi tetikler ve döngü oluşur.
 *
 * Şerit eklenmeden önce kategoriye tıklamak BAŞKA bir sayfadan geliyordu ve
 * bileşen sıfırdan kuruluyordu. Şerit her sayfada olduğu için artık aynı
 * sayfada kalıyoruz; bu yüzden adres değişimini elle dinlemek gerekiyor.
 */
let adrestenOkunuyor = false;

function syncUrl() {
  router.replace({
    query: {
      ...(filters.q ? { ara: filters.q } : {}),
      ...(filters.category.length ? { kategori: filters.category.join(",") } : {}),
      ...(filters.store.length ? { magaza: filters.store.join(",") } : {}),
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
        category: filters.category.join(","),
        store: filters.store.join(","),
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

/**
 * Açık olan filtreler, tek tek kaldırılabilsin diye düz bir liste olarak.
 *
 * Çoklu seçimde kenar çubuğuna bakmadan "şu an neye göre süzülüyorum?"
 * sorusunun yanıtı görünmüyordu; rozetler bunu listenin hemen üstüne taşıyor.
 */
const acikFiltreler = computed(() => {
  const rozetler = [];
  for (const slug of filters.category) {
    const kategori = categories.value.find((aday) => aday.slug === slug);
    rozetler.push({ anahtar: `kategori:${slug}`, etiket: kategori?.name ?? slug, tur: "category", deger: slug });
  }
  for (const slug of filters.store) {
    const magaza = stores.value.find((aday) => aday.slug === slug);
    rozetler.push({ anahtar: `magaza:${slug}`, etiket: magaza?.name ?? slug, tur: "store", deger: slug });
  }
  if (filters.inStock) rozetler.push({ anahtar: "stokta", etiket: "Stokta olanlar", tur: "inStock" });
  if (filters.minPrice) rozetler.push({ anahtar: "min", etiket: `En az ${filters.minPrice} ₺`, tur: "minPrice" });
  if (filters.maxPrice) rozetler.push({ anahtar: "max", etiket: `En çok ${filters.maxPrice} ₺`, tur: "maxPrice" });
  if (filters.q) rozetler.push({ anahtar: "ara", etiket: `"${filters.q}"`, tur: "q" });
  return rozetler;
});

function rozetiKaldir(rozet) {
  if (rozet.tur === "category" || rozet.tur === "store") {
    filters[rozet.tur] = filters[rozet.tur].filter((slug) => slug !== rozet.deger);
    return;
  }
  if (rozet.tur === "inStock") filters.inStock = false;
  else filters[rozet.tur] = "";
}

function reset() {
  Object.assign(filters, { q: "", category: [], store: [], minPrice: "", maxPrice: "", inStock: false, sort: "newest", page: 1 });
}

let debounce;
watch(
  () => [filters.q, filters.minPrice, filters.maxPrice],
  () => {
    if (adrestenOkunuyor) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.page = 1;
      syncUrl();
      load();
    }, 350);
  }
);

// Onay kutuları diziyi YERİNDE değiştirir; referans aynı kaldığı için
// dizinin kendisini izlemek tetiklemez. Birleştirilmiş hali izleniyor.
watch(
  () => [filters.category.join(","), filters.store.join(","), filters.sort, filters.inStock],
  () => {
    if (adrestenOkunuyor) return;
    filters.page = 1;
    syncUrl();
    load();
  }
);

watch(
  () => filters.page,
  () => {
    if (adrestenOkunuyor) return;
    syncUrl();
    load();
  }
);

/*
 * Adres çubuğu dışarıdan değiştiğinde filtreleri ondan tazele.
 *
 * Gelen sorgu, filtrelerimizin ÜRETECEĞİ sorguyla aynıysa bu bizim kendi
 * syncUrl çağrımızdır; dokunmazsak döngü oluşmaz.
 */
watch(
  () => route.query,
  (yeni) => {
    const gelen = sorgudanFiltreler(yeni);
    if (JSON.stringify(gelen) === JSON.stringify(filtrelerinOzeti())) return;

    adrestenOkunuyor = true;
    Object.assign(filters, gelen);
    // İzleyiciler bu akışta çalışıp bayrağı görür; sonraki tikte indiriyoruz.
    nextTick(() => {
      adrestenOkunuyor = false;
    });
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

    <!--
      Dar ekranda filtreler KATLI gelir. Onay kutulu listeler açılır listelerden
      uzun; açık bırakılsaydı telefonda ürünlere ulaşmak için bütün filtreleri
      geçmek gerekirdi. Geniş ekranda düğme gizlenir, panel hep açıktır.
    -->
    <button
      type="button"
      class="btn-secondary mb-3 w-full lg:hidden"
      :aria-expanded="filtrelerAcik"
      @click="filtrelerAcik = !filtrelerAcik"
    >
      Filtrele<span v-if="acikFiltreler.length"> ({{ acikFiltreler.length }})</span>
    </button>

    <div class="grid gap-6 lg:grid-cols-[260px_1fr]">
      <!--
        top-32: yapışkan başlık (logo satırı + kategori şeridi) kadar aşağıda
        durur, yoksa filtreler başlığın altında kalırdı. Yalnızca geniş
        ekranda yapışkan; dar ekranda kenar çubuğu zaten akar.
      -->
      <aside
        class="card h-fit space-y-4 p-4 lg:sticky lg:top-32 lg:block"
        :class="filtrelerAcik ? 'block' : 'hidden'"
      >
        <div>
          <label for="search" class="field-label">Ara</label>
          <input id="search" v-model="filters.q" type="search" class="field" placeholder="Ürün, marka…" maxlength="100" />
        </div>

        <!--
          Açılır liste yerine onay kutuları: tek seçimle "laptop VEYA monitör"
          gibi bir süzme yapılamıyordu. Uzun listeler kenar çubuğunu
          taşırmasın diye kendi içlerinde kayıyor.
        -->
        <fieldset>
          <legend class="field-label">Kategori</legend>
          <div class="max-h-52 space-y-1 overflow-y-auto pr-1">
            <label
              v-for="category in categories"
              :key="category.id"
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink-700 hover:bg-ink-50"
            >
              <input v-model="filters.category" type="checkbox" :value="category.slug" class="rounded border-ink-300" />
              <span class="flex-1 truncate">{{ category.name }}</span>
              <span class="text-xs text-ink-400">{{ category.productCount }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend class="field-label">Mağaza</legend>
          <div class="max-h-52 space-y-1 overflow-y-auto pr-1">
            <label
              v-for="store in stores"
              :key="store.id"
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink-700 hover:bg-ink-50"
            >
              <input v-model="filters.store" type="checkbox" :value="store.slug" class="rounded border-ink-300" />
              <span class="flex-1 truncate">{{ store.name }}</span>
            </label>
          </div>
        </fieldset>

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
        <!-- Açık filtreler: hangi süzgecin etkili olduğu listenin üstünde görünür. -->
        <div v-if="acikFiltreler.length" class="mb-3 flex flex-wrap items-center gap-2">
          <button
            v-for="rozet in acikFiltreler"
            :key="rozet.anahtar"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 py-1 pl-3 pr-2 text-sm text-ink-700 hover:border-ink-300 hover:bg-ink-100"
            @click="rozetiKaldir(rozet)"
          >
            {{ rozet.etiket }}
            <span class="text-ink-400" aria-hidden="true">×</span>
            <span class="sr-only">filtresini kaldır</span>
          </button>
          <button type="button" class="text-sm font-medium text-brand-600 hover:text-brand-700" @click="reset">
            Tümünü temizle
          </button>
        </div>

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

        <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
