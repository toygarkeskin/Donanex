<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, query } from "../../lib/api";
import { money, formatDate, ORDER_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";

const route = useRoute();
const router = useRouter();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
/*
 * Durum adresten okunuyor: genel bakıştaki "Ödeme bekleyen" kutusu buraya
 * süzülmüş olarak geliyor. Adresten gelmesi ayrıca bağlantının
 * paylaşılabilir olmasını sağlıyor — mağazalar sayfası da aynı kuralı
 * kullanıyor ("durum").
 */
const filters = reactive({ q: "", status: route.query.durum || "", from: "", to: "", page: 1 });

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/admin/orders${query(filters)}`);
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
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Siparişler" description="Sistemdeki tüm siparişler." />

    <div class="mb-4 flex flex-wrap gap-3">
      <input v-model="filters.q" type="search" class="field max-w-xs" placeholder="Sipariş no, müşteri, e-posta…" />
      <select v-model="filters.status" class="field w-auto" aria-label="Durum">
        <option value="">Tüm durumlar</option>
        <option v-for="(meta, key) in ORDER_STATUS" :key="key" :value="key">{{ meta.label }}</option>
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
              <th class="text-right">Mağaza</th>
              <th>Tarih</th>
              <th>Durum</th>
              <th class="text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in result.items"
              :key="order.id"
              class="cursor-pointer hover:bg-ink-50"
              @click="router.push({ name: 'admin-order', params: { orderNo: order.orderNumber } })"
            >
              <td class="font-medium text-ink-800">{{ order.orderNumber }}</td>
              <td>
                <p class="text-sm">{{ order.customerName }}</p>
                <p class="text-xs text-ink-500">
                  {{ order.customerEmail }}
                  <span v-if="!order.userId" class="text-ink-400">· misafir</span>
                </p>
              </td>
              <td class="text-right">{{ order.packages.length }}</td>
              <td class="whitespace-nowrap text-ink-500">{{ formatDate(order.placedAt, false) }}</td>
              <td><StatusBadge :map="ORDER_STATUS" :value="order.status" /></td>
              <td class="text-right font-medium">{{ money(order.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar
        :page="result.page"
        :pages="result.pages"
        :total="result.total"
        unit="sipariş"
        @change="(next) => (filters.page = next)"
      />
    </template>
  </div>
</template>
