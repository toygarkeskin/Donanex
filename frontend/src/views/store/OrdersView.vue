<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, query } from "../../lib/api";
import { useMagaza } from "../../lib/magaza";
import { money, formatDate, PACKAGE_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";

const route = useRoute();
const { id: storeId, params: magazaParams } = useMagaza();
const router = useRouter();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const filters = reactive({ q: "", status: "", from: "", to: "", page: 1 });

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/stores/${storeId.value}/orders${query(filters)}`);
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  Object.assign(filters, { q: "", status: "", from: "", to: "", page: 1 });
}

let debounce;
watch(
  () => filters.q,
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.page = 1;
      load();
    }, 350);
  }
);
watch(() => [filters.status, filters.from, filters.to], () => {
  filters.page = 1;
  load();
});
watch(() => filters.page, load);
watch(() => storeId.value, load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Siparişler" description="Mağazanıza düşen paketler." />

    <div class="mb-4 flex flex-wrap gap-3">
      <input v-model="filters.q" type="search" class="field max-w-xs" placeholder="Sipariş no, müşteri, ürün…" />
      <select v-model="filters.status" class="field w-auto" aria-label="Durum">
        <option value="">Tüm durumlar</option>
        <option v-for="(meta, key) in PACKAGE_STATUS" :key="key" :value="key">{{ meta.label }}</option>
      </select>
      <input v-model="filters.from" type="date" class="field w-auto" aria-label="Başlangıç" />
      <input v-model="filters.to" type="date" class="field w-auto" aria-label="Bitiş" />
      <button type="button" class="btn-secondary" @click="clearFilters">Temizle</button>
    </div>

    <LoadingBlock v-if="loading" :rows="4" />

    <EmptyState v-else-if="!result.items.length" title="Sipariş bulunamadı" icon="kargo" />

    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Sipariş</th>
              <th>Müşteri</th>
              <th>Ürünler</th>
              <th>Tarih</th>
              <th>Durum</th>
              <th class="text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pkg in result.items"
              :key="pkg.packageId"
              class="cursor-pointer hover:bg-ink-50"
              @click="router.push({ name: 'store-order', params: { ...magazaParams, orderNo: pkg.orderNumber } })"
            >
              <td class="font-medium text-ink-800">{{ pkg.orderNumber }}</td>
              <td>{{ pkg.customerName }}</td>
              <td class="max-w-xs">
                <p v-for="item in pkg.items.slice(0, 2)" :key="item.productId" class="truncate text-xs text-ink-600">
                  {{ item.name }} × {{ item.quantity }}
                </p>
                <p v-if="pkg.items.length > 2" class="text-xs text-ink-400">
                  +{{ pkg.items.length - 2 }} ürün daha
                </p>
              </td>
              <td class="whitespace-nowrap text-ink-500">{{ formatDate(pkg.placedAt, false) }}</td>
              <td><StatusBadge :map="PACKAGE_STATUS" :value="pkg.status" /></td>
              <td class="text-right font-medium">{{ money(pkg.subtotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar
        :page="result.page"
        :pages="result.pages"
        :total="result.total"
        unit="paket"
        @change="(next) => (filters.page = next)"
      />
    </template>
  </div>
</template>
