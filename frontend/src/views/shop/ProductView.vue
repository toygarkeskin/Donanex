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

const route = useRoute();
const cart = useCartStore();
const toast = useToastStore();

const product = ref(null);
const loading = ref(true);
const notFound = ref(false);
const quantity = ref(1);
const adding = ref(false);

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    product.value = await api.get(`/products/${route.params.storeSlug}/${route.params.productSlug}`);
    quantity.value = 1;
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
    <div class="card flex items-center justify-center overflow-hidden bg-white p-8">
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
    </div>
  </div>
</template>
