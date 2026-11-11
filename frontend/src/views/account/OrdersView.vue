<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, query } from "../../lib/api";
import { money, formatDate, ORDER_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import ProductImage from "../../components/ProductImage.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const page = ref(1);

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/me/orders${query({ page: page.value, pageSize: 10 })}`);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Siparişlerim" />

    <LoadingBlock v-if="loading" :rows="3" />

    <EmptyState
      v-else-if="!result.items.length"
      title="Henüz siparişiniz yok"
      description="Beğendiğiniz ürünleri sepete ekleyip ilk siparişinizi verebilirsiniz."
      icon="📦"
    >
      <RouterLink :to="{ name: 'products' }" class="btn-primary">Alışverişe başla</RouterLink>
    </EmptyState>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="order in result.items"
        :key="order.id"
        :to="{ name: 'account-order', params: { orderId: order.id } }"
        class="card flex flex-wrap items-center gap-4 p-4 transition hover:shadow-md"
      >
        <div class="min-w-40 flex-1">
          <p class="font-semibold text-ink-900">{{ order.orderNumber }}</p>
          <p class="text-sm text-ink-500">{{ formatDate(order.placedAt) }}</p>
        </div>

        <div class="flex -space-x-2">
          <div
            v-for="item in order.packages.flatMap((p) => p.items).slice(0, 4)"
            :key="item.productId"
            class="h-10 w-10 overflow-hidden rounded-lg border-2 border-white"
          >
            <ProductImage :src="item.imageUrl" :alt="item.name" padding="p-0.5" blur-class="blur-md" />
          </div>
        </div>

        <p class="text-sm text-ink-500">{{ order.packages.length }} mağaza</p>
        <StatusBadge :map="ORDER_STATUS" :value="order.status" />
        <p class="w-28 text-right font-bold text-ink-900">{{ money(order.total) }}</p>
      </RouterLink>

      <PaginationBar
        :page="result.page"
        :pages="result.pages"
        :total="result.total"
        unit="sipariş"
        @change="(next) => { page = next; load(); }"
      />
    </div>
  </div>
</template>
