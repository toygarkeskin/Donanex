<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { money } from "../lib/format";
import { useCartStore } from "../stores/cart";
import { useToastStore } from "../stores/toast";

const props = defineProps({ product: { type: Object, required: true } });

const cart = useCartStore();
const toast = useToastStore();
const adding = ref(false);

async function addToCart() {
  adding.value = true;
  try {
    await cart.add(props.product.id, 1);
    // Kayıtsız kullanıcı da sepete ekleyebilir; sepet sunucuda saklanır.
    toast.success(`${props.product.name} sepete eklendi.`);
  } catch (error) {
    toast.error(error.message);
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <article class="card group flex flex-col overflow-hidden transition hover:shadow-md">
    <RouterLink
      :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }"
      class="block aspect-4/3 overflow-hidden bg-ink-100"
    >
      <img
        :src="product.imageUrl"
        :alt="product.name"
        loading="lazy"
        class="h-full w-full object-contain p-4 transition group-hover:scale-105"
      />
    </RouterLink>

    <div class="flex flex-1 flex-col gap-2 p-4">
      <RouterLink
        :to="{ name: 'store', params: { slug: product.storeSlug } }"
        class="text-xs font-medium text-ink-400 hover:text-brand-600"
      >
        {{ product.storeName }}
      </RouterLink>

      <h3 class="line-clamp-2 flex-1 text-sm font-semibold text-ink-800">
        <RouterLink :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }">
          {{ product.name }}
        </RouterLink>
      </h3>

      <p class="text-lg font-bold text-ink-900">{{ money(product.price) }}</p>

      <p v-if="product.stock > 0 && product.stock <= 5" class="text-xs font-medium text-amber-700">
        Son {{ product.stock }} ürün
      </p>
      <p v-else-if="product.stock <= 0" class="text-xs font-medium text-red-600">Stokta yok</p>

      <button type="button" class="btn-primary mt-1 w-full" :disabled="product.stock <= 0 || adding" @click="addToCart">
        {{ product.stock <= 0 ? "Stokta yok" : adding ? "Ekleniyor…" : "Sepete ekle" }}
      </button>
    </div>
  </article>
</template>
