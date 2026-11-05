<script setup>
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money, formatDate, PACKAGE_STATUS, STORE_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import StatCard from "../../components/StatCard.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const summary = ref(null);
const store = ref(null);
const recent = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const storeId = route.params.storeId;
    const [dashboard, storeInfo, orders] = await Promise.all([
      api.get(`/stores/${storeId}/dashboard`),
      api.get(`/stores/${storeId}`),
      api.get(`/stores/${storeId}/orders?pageSize=5`)
    ]);
    summary.value = dashboard;
    store.value = storeInfo;
    recent.value = orders.items;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.params.storeId, load);
</script>

<template>
  <div>
    <PageHeader title="Genel bakış" :description="store?.name">
      <template #actions>
        <RouterLink
          :to="{ name: 'store-product-new', params: { storeId: route.params.storeId } }"
          class="btn-primary"
        >
          + Yeni ürün
        </RouterLink>
      </template>
    </PageHeader>

    <AlertBox v-if="store && store.status !== 'active'" tone="warn" class="mb-6" title="Mağazanız satışa kapalı">
      Durum: <StatusBadge :map="STORE_STATUS" :value="store.status" />
      — Onaylanana kadar ürünleriniz vitrinde görünmez.
    </AlertBox>

    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="summary">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Yayındaki ürün" :value="summary.activeProducts" />
        <StatCard label="Taslak ürün" :value="summary.draftProducts" />
        <StatCard
          label="Azalan stok"
          :value="summary.lowStock"
          :tone="summary.lowStock > 0 ? 'warn' : 'neutral'"
          hint="3 adet ve altı"
        />
        <StatCard label="Toplam ciro" :value="money(summary.revenue)" tone="good" hint="Ödenen siparişler" />
        <StatCard
          label="Bekleyen paket"
          :value="summary.pendingPackages"
          :tone="summary.pendingPackages > 0 ? 'warn' : 'neutral'"
        />
        <StatCard label="Hazırlanan paket" :value="summary.preparingPackages" />
        <StatCard label="Toplam paket" :value="summary.totalPackages" />
        <StatCard
          label="Açık destek talebi"
          :value="summary.openTickets"
          :tone="summary.openTickets > 0 ? 'warn' : 'neutral'"
        />
      </div>

      <section class="mt-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-900">Son siparişler</h2>
          <RouterLink
            :to="{ name: 'store-orders', params: { storeId: route.params.storeId } }"
            class="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Tümünü gör →
          </RouterLink>
        </div>

        <p v-if="!recent.length" class="card p-6 text-center text-sm text-ink-500">Henüz sipariş yok.</p>

        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Sipariş</th>
                <th>Müşteri</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th class="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="pkg in recent"
                :key="pkg.packageId"
                class="cursor-pointer hover:bg-ink-50"
                @click="$router.push({ name: 'store-order', params: { storeId: route.params.storeId, packageId: pkg.packageId } })"
              >
                <td class="font-medium text-ink-800">{{ pkg.orderNumber }}</td>
                <td>{{ pkg.customerName }}</td>
                <td class="text-ink-500">{{ formatDate(pkg.placedAt, false) }}</td>
                <td><StatusBadge :map="PACKAGE_STATUS" :value="pkg.status" /></td>
                <td class="text-right font-medium">{{ money(pkg.subtotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
