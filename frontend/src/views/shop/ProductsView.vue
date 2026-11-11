<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, query } from "../../lib/api";
import ProductCard from "../../components/ProductCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import PageHeader from "../../components/PageHeader.vue";
import AppIcon from "../../components/AppIcon.vue";
import CategoryStrip from "../../components/CategoryStrip.vue";
import FiltreBolumu from "../../components/FiltreBolumu.vue";

const route = useRoute();
const router = useRouter();

/** Dar ekranda filtre panelinin açık olup olmadığı; geniş ekranda kullanılmaz. */
const filtrelerAcik = ref(false);

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
/**
 * Sayfa başına ürün.
 *
 * 20, ızgaranın her genişliğinde TAM satır veriyor: telefonda 2 sütun (10
 * satır), tablette 3 (… ve son satırda 2 eksik kalmıyor çünkü 20 ikiye,
 * dörde ve beşe bölünüyor), geniş ekranda 4 sütun (5 satır). 24'te son
 * satır 5 sütunlu düzende yarım kalıyordu.
 */
const SAYFA_BASINA = 20;

const categories = ref([]);
const stores = ref([]);
const brands = ref([]);
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
    brand: listeyeCevir(sorgu.marka),
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
    // Anahtar SIRASI sorgudanFiltreler ile aynı olmalı: karşılaştırma
    // JSON.stringify ile yapılıyor ve sıra değişirse iki özdeş filtre
    // farklı görünüp adres izleyicisini boşuna tetikliyor.
    brand: [...filters.brand],
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
      ...(filters.brand.length ? { marka: filters.brand.join(",") } : {}),
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
        brand: filters.brand.join(","),
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        inStock: filters.inStock ? "true" : "",
        sort: filters.sort,
        page: filters.page,
        pageSize: SAYFA_BASINA
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
/**
 * Sayfanın başlığı: ne süzülüyorsa o.
 *
 * Tek kategori ya da tek marka seçiliyse onun adı yazıyor; arama varsa
 * aranan terim. Birden çok seçimde geri "Ürünler"e dönüyor, çünkü
 * "Laptop, Monitör ve Mouse" gibi bir başlık okunmuyor — o durumda
 * rozetler zaten neyin seçili olduğunu gösteriyor.
 */
const sayfaBasligi = computed(() => {
  if (filters.q) return `"${filters.q}" için sonuçlar`;
  if (filters.category.length === 1) {
    return categories.value.find((k) => k.slug === filters.category[0])?.name ?? "Ürünler";
  }
  if (filters.brand.length === 1) {
    return brands.value.find((m) => m.slug === filters.brand[0])?.name ?? "Ürünler";
  }
  return "Ürünler";
});

/** Yükleme bitmeden sayı yazılmıyor: bir an "0 ürün" görünmesi yanlış bilgi. */
const sayfaAciklamasi = computed(() => {
  if (loading.value) return "";
  return result.value.total > 0 ? `${result.value.total} ürün` : "Sonuç yok";
});

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
  for (const slug of filters.brand) {
    const marka = brands.value.find((aday) => aday.slug === slug);
    rozetler.push({ anahtar: `marka:${slug}`, etiket: marka?.name ?? slug, tur: "brand", deger: slug });
  }
  if (filters.inStock) rozetler.push({ anahtar: "stokta", etiket: "Stokta olanlar", tur: "inStock" });
  if (filters.minPrice) rozetler.push({ anahtar: "min", etiket: `En az ${filters.minPrice} ₺`, tur: "minPrice" });
  if (filters.maxPrice) rozetler.push({ anahtar: "max", etiket: `En çok ${filters.maxPrice} ₺`, tur: "maxPrice" });
  if (filters.q) rozetler.push({ anahtar: "ara", etiket: `"${filters.q}"`, tur: "q" });
  return rozetler;
});

function rozetiKaldir(rozet) {
  if (rozet.tur === "category" || rozet.tur === "store" || rozet.tur === "brand") {
    filters[rozet.tur] = filters[rozet.tur].filter((slug) => slug !== rozet.deger);
    return;
  }
  if (rozet.tur === "inStock") filters.inStock = false;
  else filters[rozet.tur] = "";
}

function reset() {
  Object.assign(filters, { q: "", category: [], store: [], brand: [], minPrice: "", maxPrice: "", inStock: false, sort: "newest", page: 1 });
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
  () => [filters.category.join(","), filters.store.join(","), filters.brand.join(","), filters.sort, filters.inStock],
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
  const [categoryList, storeList, brandList] = await Promise.all([
    api.get("/categories"),
    api.get("/storefront/stores"),
    api.get("/brands")
  ]);
  categories.value = categoryList.items;
  stores.value = storeList.items;
  brands.value = brandList.items;
  await load();
});
</script>

<template>
  <div>
    <!--
      Başlık seçili filtreye göre değişiyor.
      Her durumda "Ürünler" yazsaydı, kategoriye tıklayan kullanıcı aynı
      sayfada kalmış gibi hissederdi — oysa liste değişti. Ürün sayısı da
      başlığın altında: ayrı bir satır olarak yer kaplamasına gerek yok.
    -->
    <PageHeader :title="sayfaBasligi" :description="sayfaAciklamasi" />

    <!--
      Kategori şeridi ARTIK SADECE BURADA.
      Eskiden her sayfanın üstündeydi ve bütün sayfaları birbirine
      benzetiyordu. Burada ise bir filtre aracı: tıklanan kategori adres
      çubuğuna yazılıyor ve liste ona göre süzülüyor.
    -->
    <CategoryStrip
      :categories="categories"
      class="-mx-4 mb-4 rounded-none border-x-0 border-t-0 sm:mx-0 sm:rounded-xl sm:border"
    />

    <!--
      Dar ekranda filtreler KATLI gelir. Onay kutulu listeler açılır listelerden
      uzun; açık bırakılsaydı telefonda ürünlere ulaşmak için bütün filtreleri
      geçmek gerekirdi. Geniş ekranda düğme gizlenir, panel hep açıktır.
    -->

    <!--
      Panel açıkken arkadaki sayfa soluklaşıyor. Karartma yalnızca süs değil:
      açılan panelin nerede bittiği, arkasının tıklanamadığı ve kapatmak için
      dışarı basılabileceği bundan anlaşılıyor.
    -->
    <Transition
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition-opacity"
      leave-active-class="transition-opacity"
    >
      <div v-if="filtrelerAcik" class="mat-zemin lg:hidden" @click="filtrelerAcik = false" />
    </Transition>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <!--
        TELEFONDA alttan açılan bir panel, GENİŞ ekranda yapışkan kenar çubuğu
        — tek bir işaretleme. Filtre alanları iki yerde de aynı olduğu için
        ikinci bir kopya yazmak, birini güncelleyip diğerini unutmaya davetiye
        olurdu.

        Önceden telefonda panel sayfanın akışında açılıyordu: ürün ızgarasını
        aşağı itiyor, filtreyi kapatmak için en alta inmek gerekiyordu.

        top-28: geniş ekranda yapışkan başlığın yüksekliği kadar (logo satırı
        64px + kategori şeridi ~44px) aşağıda durur.
      -->
      <aside
        class="card space-y-4 p-4 lg:static lg:z-auto lg:block lg:h-fit lg:max-h-none lg:overflow-visible lg:rounded-xl lg:pb-4 lg:sticky lg:top-28"
        :class="
          filtrelerAcik
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-b-none rounded-t-2xl pt-0 pb-24 lg:pt-4'
            : 'hidden'
        "
      >
        <!--
          Telefonda panel başlığı; yapışkan, çünkü içerik uzun ve kaydırılıyor.

          Üst marjı NEGATİF DEĞİL: kaydırma kutusunda "sticky top-0" elemanı
          kutunun üst kenarına yapıştırır, negatif marjla yukarı çekilen bir
          başlık ise yapıştığı yere geri itilip altındaki alanın üstüne
          biniyordu. Bunun yerine panelin üst dolgusu kaldırıldı (pt-0) ve
          boşluğu başlığın kendi py'si veriyor.
        -->
        <div
          class="sticky top-0 z-10 -mx-4 mb-1 flex items-center justify-between border-b border-ink-200 bg-surface px-4 py-3 lg:hidden"
        >
          <p class="text-sm font-semibold text-ink-900">Filtrele</p>
          <button
            type="button"
            class="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Filtreleri kapat"
            @click="filtrelerAcik = false"
          >
            <AppIcon name="kapat" :size="18" />
          </button>
        </div>

        <div>
          <label for="search" class="field-label">Ara</label>
          <input id="search" v-model="filters.q" type="search" class="field" placeholder="Ürün, marka…" maxlength="100" />
        </div>

        <!--
          Açılır liste yerine onay kutuları: tek seçimle "laptop VEYA monitör"
          gibi bir süzme yapılamıyordu. Uzun listeler kenar çubuğunu
          taşırmasın diye kendi içlerinde kayıyor.
        -->
        <FiltreBolumu baslik="Kategori" :secili="filters.category.length" :varsayilan-acik="true">
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
        </FiltreBolumu>

        <FiltreBolumu baslik="Marka" :secili="filters.brand.length">
          <div class="max-h-52 space-y-1 overflow-y-auto pr-1">
            <label
              v-for="marka in brands"
              :key="marka.id"
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink-700 hover:bg-ink-50"
            >
              <input v-model="filters.brand" type="checkbox" :value="marka.slug" class="rounded border-ink-300" />
              <span class="flex-1 truncate">{{ marka.name }}</span>
              <span class="text-xs text-ink-400">{{ marka.productCount }}</span>
            </label>
          </div>
        </FiltreBolumu>

        <FiltreBolumu baslik="Mağaza" :secili="filters.store.length">
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
        </FiltreBolumu>

        <FiltreBolumu baslik="Fiyat aralığı" :secili="(filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0)">
          <div class="flex items-center gap-2">
            <input v-model="filters.minPrice" type="number" min="0" class="field" placeholder="En az" aria-label="En az fiyat" />
            <span class="text-ink-400">–</span>
            <input v-model="filters.maxPrice" type="number" min="0" class="field" placeholder="En çok" aria-label="En çok fiyat" />
          </div>
        </FiltreBolumu>

        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="filters.inStock" type="checkbox" class="rounded border-ink-300" />
          Yalnızca stokta olanlar
        </label>

        <button type="button" class="btn-secondary w-full" @click="reset">Filtreleri temizle</button>

        <!--
          Telefonda panelin dibinde sabit duran onay çubuğu. Sonuç sayısı
          burada yazıyor çünkü filtre seçilirken liste arkada kalıyor ve
          kullanıcı kaç ürün kaldığını göremiyor.
        -->
        <div
          class="fixed inset-x-0 bottom-0 border-t border-ink-200 bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <button type="button" class="btn-primary w-full" @click="filtrelerAcik = false">
            {{ result.total }} ürünü göster
          </button>
        </div>
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

        <!--
          Filtre ve sıralama TEK SATIRDA. Önce telefonda alt alta iki blok
          vardı: tam genişlikte "Filtrele" düğmesi, altında sayı ve sıralama.
          İkisi de aynı işi yapıyor (listeyi daraltmak), bu yüzden aynı
          satırda olmaları gerekiyordu; ürün sayısı da başlığa taşındı.

          Düğme yalnızca dar ekranda: geniş ekranda filtreler zaten solda
          açık duruyor.
        -->
        <div class="mb-4 flex items-center gap-3">
          <button
            type="button"
            class="btn-secondary flex shrink-0 items-center gap-2 lg:hidden"
            :aria-expanded="filtrelerAcik"
            @click="filtrelerAcik = true"
          >
            <AppIcon name="filtre" :size="17" />
            Filtrele
            <span
              v-if="acikFiltreler.length"
              class="rounded-full bg-brand-600 px-1.5 text-xs font-bold leading-5 text-white"
            >
              {{ acikFiltreler.length }}
            </span>
          </button>

          <select v-model="filters.sort" class="field ml-auto w-auto shrink-0" aria-label="Sıralama">
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
