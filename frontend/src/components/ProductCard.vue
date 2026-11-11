<script setup>
import { RouterLink } from "vue-router";
import { money } from "../lib/format";
import ProductImage from "./ProductImage.vue";

/*
 * Ürün kartı.
 *
 * SEPETE EKLE DÜĞMESİ YOK — bilinçli.
 *
 * Listedeki kart ürünün adını, fotoğrafını ve fiyatını gösterir; stok
 * durumu, açıklaması, satıcısının kargo koşulu ve kaç adet alınacağı ürün
 * sayfasındadır. Listeden tek tıkla sepete atmak, kullanıcıyı neyi
 * aldığını görmeden karar vermeye itiyordu. Trendyol da dahil büyük
 * pazar yerleri kartı bir DAVET olarak kullanır, bir kasa olarak değil.
 *
 * Yan faydası: kart artık yalnızca bağlantılardan oluşuyor; sepete ekleme
 * tek bir yerde (ürün sayfası) yaşıyor.
 */
defineProps({ product: { type: Object, required: true } });
</script>

<template>
  <!--
    Kare görsel alanı: ürün fotoğrafları çoğunlukla kare çekiliyor, 4:3'te
    yanlarda boşluk kalıyordu. Kare oran kartı bir miktar UZATIR; ekran başına
    düşen ürün sayısındaki artış orandan değil, ızgaranın 4 sütuna çıkması ve
    iç boşlukların daralmasından geliyor.
  -->
  <article class="card group flex flex-col overflow-hidden transition hover:shadow-md">
    <RouterLink
      :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }"
      class="block aspect-square overflow-hidden transition group-hover:scale-105"
    >
      <ProductImage :src="product.imageUrl" :alt="product.name" />
    </RouterLink>

    <div class="flex flex-1 flex-col gap-1 p-3">
      <RouterLink
        :to="{ name: 'store', params: { slug: product.storeSlug } }"
        class="text-xs font-medium text-ink-400 hover:text-brand-600"
      >
        {{ product.storeName }}
      </RouterLink>

      <h3 class="line-clamp-2 flex-1 text-sm font-medium leading-snug text-ink-800">
        <RouterLink :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }">
          {{ product.name }}
        </RouterLink>
      </h3>

      <!--
        Fiyat kartın en güçlü öğesi: düğme gittiği için kullanıcının aradığı
        bilgi bu. Marka mavisiyle yazılıyor, böylece ızgarada göz fiyattan
        fiyata atlayabiliyor.
      -->
      <p class="mt-1 text-lg font-bold leading-tight text-brand-600">{{ money(product.price) }}</p>

      <p v-if="product.stock > 0 && product.stock <= 5" class="text-xs font-medium text-amber-700">
        Son {{ product.stock }} ürün
      </p>
      <p v-else-if="product.stock <= 0" class="text-xs font-medium text-red-600">Stokta yok</p>
    </div>
  </article>
</template>
