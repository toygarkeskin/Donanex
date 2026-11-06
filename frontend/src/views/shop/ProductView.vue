<script setup>
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { useCartStore } from "../../stores/cart";
import { useToastStore } from "../../stores/toast";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import AlertBox from "../../components/AlertBox.vue";
import ProductCard from "../../components/ProductCard.vue";

const route = useRoute();
const cart = useCartStore();
const toast = useToastStore();

const product = ref(null);
const loading = ref(true);
const notFound = ref(false);
const quantity = ref(1);
const adding = ref(false);
const benzerler = ref([]);

/**
 * Aynı kategorideki diğer ürünler.
 *
 * Ürünün kendisi listeden çıkarılır ve en fazla dört tane gösterilir.
 * Bulunamazsa bölüm hiç çizilmez — boş bir "Benzer ürünler" başlığı
 * göstermek, öneri varmış gibi durup olmamasından daha kötü.
 */
async function benzerleriYukle() {
  benzerler.value = [];
  if (!product.value?.categorySlug) return;
  try {
    const sonuc = await api.get(`/products?category=${encodeURIComponent(product.value.categorySlug)}&pageSize=8`);
    benzerler.value = (sonuc.items ?? []).filter((aday) => aday.id !== product.value.id).slice(0, 4);
  } catch {
    /* öneri getirilemezse sayfa olduğu gibi çalışır */
  }
}

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    product.value = await api.get(`/products/${route.params.storeSlug}/${route.params.productSlug}`);
    quantity.value = 1;
    benzerleriYukle();
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
}

async function addToCart() {
  adding.value = true;
  try {
    await cart.add(product.value.id, Number(quantity.value));
    toast.success(`${product.value.name} sepete eklendi.`);
  } catch (error) {
    toast.error(error.message);
  } finally {
    adding.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);
</script>

<template>
  <LoadingBlock v-if="loading" :rows="4" />

  <EmptyState
    v-else-if="notFound"
    title="Ürün bulunamadı"
    description="Ürün kaldırılmış ya da satıcı mağazasını kapatmış olabilir."
    icon="🔍"
  >
    <RouterLink :to="{ name: 'products' }" class="btn-primary">Ürünlere dön</RouterLink>
  </EmptyState>

  <div v-else class="grid gap-8 lg:grid-cols-2">
    <div class="card flex items-center justify-center overflow-hidden bg-surface p-8">
      <img :src="product.imageUrl" :alt="product.name" class="max-h-[420px] w-full object-contain" />
    </div>

    <div>
      <nav class="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-500" aria-label="Yol">
        <RouterLink :to="{ name: 'products' }" class="hover:text-brand-600">Ürünler</RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink
          v-if="product.categorySlug"
          :to="{ name: 'products', query: { kategori: product.categorySlug } }"
          class="hover:text-brand-600"
        >
          {{ product.categoryName }}
        </RouterLink>
      </nav>

      <h1 class="text-2xl font-bold tracking-tight text-ink-900">{{ product.name }}</h1>

      <RouterLink
        :to="{ name: 'store', params: { slug: product.storeSlug } }"
        class="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        🏪 {{ product.storeName }}
      </RouterLink>

      <p class="mt-6 text-3xl font-bold text-ink-900">{{ money(product.price) }}</p>

      <p v-if="product.stock > 0" class="mt-2 text-sm text-ink-500">
        Stokta <strong class="text-ink-800">{{ product.stock }}</strong> adet
      </p>
      <p v-else class="mt-2 text-sm font-medium text-red-600">Bu ürün şu anda stokta yok.</p>

      <div v-if="product.stock > 0" class="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label for="quantity" class="field-label">Adet</label>
          <input
            id="quantity"
            v-model="quantity"
            type="number"
            min="1"
            :max="Math.min(99, product.stock)"
            class="field w-24"
          />
        </div>
        <button type="button" class="btn-primary h-10 px-6" :disabled="adding" @click="addToCart">
          {{ adding ? "Ekleniyor…" : "Sepete ekle" }}
        </button>
      </div>

      <AlertBox v-if="product.stock > 0 && product.stock <= 5" tone="warn" class="mt-4">
        Son {{ product.stock }} ürün — stok bitmeden sipariş verin.
      </AlertBox>

      <div class="mt-8">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-500">Ürün açıklaması</h2>
        <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{{ product.description }}</p>
      </div>

      <dl v-if="product.sku" class="mt-6 flex gap-2 text-sm">
        <dt class="text-ink-500">Stok kodu:</dt>
        <dd class="font-medium text-ink-800">{{ product.sku }}</dd>
      </dl>

      <!--
        Teslimat ve satıcı bilgisi. Burada yalnızca sistemin GERÇEKTEN
        bildiği şeyler yazıyor: kargo ücretsiz (sepet de böyle hesaplıyor),
        gönderim satıcıdan yapılıyor ve sipariş takip edilebiliyor.
        Tahmini teslim tarihi YOK — öyle bir veri tutulmuyor, uydurmak
        müşteriye yanlış söz vermek olurdu.
      -->
      <div class="mt-8 space-y-3">
        <div class="card flex items-start gap-3 p-4">
          <span class="text-lg" aria-hidden="true">🚚</span>
          <div class="text-sm">
            <p class="font-semibold text-ink-800">Kargo ücretsiz</p>
            <p class="mt-0.5 text-ink-500">
              Ürün <strong class="font-medium text-ink-700">{{ product.storeName }}</strong> tarafından gönderilir.
              Siparişinizi kargoya verildikten sonra takip edebilirsiniz.
            </p>
          </div>
        </div>

        <div class="card flex items-center justify-between gap-3 p-4">
          <div class="min-w-0 text-sm">
            <p class="text-ink-500">Satıcı</p>
            <p class="truncate font-semibold text-ink-800">{{ product.storeName }}</p>
          </div>
          <RouterLink
            :to="{ name: 'store', params: { slug: product.storeSlug } }"
            class="btn-secondary shrink-0 py-1.5 text-sm"
          >
            Mağazaya git
          </RouterLink>
        </div>
      </div>
    </div>

    <section v-if="benzerler.length" class="lg:col-span-2">
      <h2 class="mb-4 text-lg font-bold text-ink-900">Benzer ürünler</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCard v-for="benzer in benzerler" :key="benzer.id" :product="benzer" />
      </div>
    </section>
  </div>
</template>
