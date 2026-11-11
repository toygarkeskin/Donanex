<script setup>
import { money, formatDate, safeUrl, PACKAGE_STATUS } from "../lib/format";
import StatusBadge from "./StatusBadge.vue";
import ProductImage from "./ProductImage.vue";

/**
 * Siparişin mağaza bazlı paketleri. Çok satıcılı yapıda bir sipariş birden
 * çok mağazaya bölünebildiği için kargo bilgisi paket seviyesindedir.
 */
defineProps({
  packages: { type: Array, default: () => [] },
  showStore: { type: Boolean, default: true }
});
</script>

<template>
  <div class="space-y-4">
    <section v-for="pkg in packages" :key="pkg.id" class="card overflow-hidden">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50 px-4 py-3">
        <div class="flex items-center gap-2">
          <span v-if="showStore" class="text-sm font-semibold text-ink-800">🏪 {{ pkg.storeName }}</span>
          <StatusBadge :map="PACKAGE_STATUS" :value="pkg.status" />
        </div>
        <span class="text-sm font-bold text-ink-900">{{ money(pkg.subtotal) }}</span>
      </header>

      <ul class="divide-y divide-ink-100">
        <li v-for="item in pkg.items" :key="item.productId" class="flex items-center gap-3 px-4 py-3">
          <div v-if="item.imageUrl" class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
            <ProductImage :src="item.imageUrl" :alt="item.name" padding="p-1" blur-class="blur-md" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink-800">{{ item.name }}</p>
            <p class="text-xs text-ink-500">{{ item.quantity }} × {{ money(item.unitPrice) }}</p>
          </div>
          <span class="text-sm font-medium text-ink-800">{{ money(item.lineTotal) }}</span>
        </li>
      </ul>

      <footer v-if="pkg.carrier || pkg.trackingNumber" class="border-t border-ink-100 px-4 py-3 text-sm">
        <p class="text-ink-600">
          <span aria-hidden="true">🚚</span>
          {{ pkg.carrier || "Kargo" }}
          <span v-if="pkg.trackingNumber" class="font-mono text-ink-800">{{ pkg.trackingNumber }}</span>
        </p>
        <a
          v-if="safeUrl(pkg.trackingUrl)"
          :href="safeUrl(pkg.trackingUrl)"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Kargo takip sayfasını aç →
        </a>
      </footer>
    </section>
  </div>
</template>
