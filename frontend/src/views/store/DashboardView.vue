<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money, formatDate, PACKAGE_STATUS, STORE_STATUS } from "../../lib/format";
import { seri, egilim, sonHafta } from "../../lib/gosterge";
import PageHeader from "../../components/PageHeader.vue";
import StatCard from "../../components/StatCard.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";
import CizgiGrafik from "../../components/CizgiGrafik.vue";

const route = useRoute();
const summary = ref(null);
const store = ref(null);
const recent = ref([]);
const loading = ref(true);
const olcut = ref("orders");

async function load() {
  loading.value = true;
  try {
    const storeId = route.params.storeId;
    const [dashboard, storeInfo, orders] = await Promise.all([
      api.get(`/stores/${storeId}/dashboard`),
      api.get(`/stores/${storeId}`),
      api.get(`/stores/${storeId}/orders?pageSize=6`)
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

const params = computed(() => ({ storeId: route.params.storeId }));
const gunler = computed(() => summary.value?.last14Days ?? []);
const grafikSerisi = computed(() => seri(gunler.value, olcut.value));

const haftalikToplam = computed(() => {
  const toplam = sonHafta(gunler.value, olcut.value);
  return olcut.value === "revenue" ? money(toplam) : `${toplam} paket`;
});

const haftalikEgilim = computed(() => egilim(gunler.value, olcut.value));

const bicim = (deger) => (olcut.value === "revenue" ? money(deger) : `${deger} paket`);
</script>

<template>
  <div>
    <PageHeader title="Genel bakış" :description="store?.name">
      <template #actions>
        <RouterLink :to="{ name: 'store-product-new', params }" class="btn-primary">+ Yeni ürün</RouterLink>
      </template>
    </PageHeader>

    <AlertBox v-if="store && store.status !== 'active'" tone="warn" class="mb-6" title="Mağazanız satışa kapalı">
      Durum: <StatusBadge :map="STORE_STATUS" :value="store.status" />
      — Onaylanana kadar ürünleriniz vitrinde görünmez.
    </AlertBox>

    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="summary">
      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Toplam ciro"
          :value="money(summary.revenue)"
          tone="good"
          icon="panel"
          hint="Ödenen siparişler"
          :trend="egilim(gunler, 'revenue')"
          trend-hint="son 7 gün"
        />
        <StatCard
          label="Bekleyen paket"
          :value="summary.pendingPackages"
          :tone="summary.pendingPackages > 0 ? 'warn' : 'neutral'"
          icon="kargo"
          :to="{ name: 'store-orders', params }"
        />
        <StatCard label="Hazırlanan paket" :value="summary.preparingPackages" icon="onay" :to="{ name: 'store-orders', params }" />
        <StatCard
          label="Açık destek talebi"
          :value="summary.openTickets"
          :tone="summary.openTickets > 0 ? 'warn' : 'neutral'"
          icon="destek"
          :to="{ name: 'store-tickets', params }"
        />
        <StatCard label="Yayındaki ürün" :value="summary.activeProducts" icon="etiket" :to="{ name: 'store-products', params }" />
        <StatCard label="Taslak ürün" :value="summary.draftProducts" icon="urunler" :to="{ name: 'store-products', params }" />
        <StatCard
          label="Azalan stok"
          :value="summary.lowStock"
          :tone="summary.lowStock > 0 ? 'warn' : 'neutral'"
          icon="filtre"
          hint="3 adet ve altı"
          :to="{ name: 'store-products', params }"
        />
        <StatCard
          label="Toplam paket"
          :value="summary.totalPackages"
          icon="sepet"
          :trend="egilim(gunler, 'orders')"
          trend-hint="son 7 gün"
        />
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section class="card min-w-0 p-4 sm:p-5">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-ink-900">Son 14 gün</h2>
              <p class="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-500">
                <span class="font-semibold text-ink-900">{{ haftalikToplam }}</span>
                <span
                  v-if="haftalikEgilim !== null"
                  class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                  :class="haftalikEgilim >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
                >
                  {{ haftalikEgilim >= 0 ? "+" : "−" }}%{{ Math.abs(Math.round(haftalikEgilim)) }}
                </span>
                <span class="text-xs text-ink-400">son 7 gün</span>
              </p>
            </div>

            <div class="flex shrink-0 rounded-lg bg-ink-100 p-0.5" role="group" aria-label="Ölçüt">
              <button
                v-for="secenek in [
                  { deger: 'orders', etiket: 'Paket' },
                  { deger: 'revenue', etiket: 'Ciro' }
                ]"
                :key="secenek.deger"
                type="button"
                class="rounded-md px-3 py-1 text-xs font-medium transition"
                :class="olcut === secenek.deger ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'"
                :aria-pressed="olcut === secenek.deger"
                @click="olcut = secenek.deger"
              >
                {{ secenek.etiket }}
              </button>
            </div>
          </div>

          <CizgiGrafik :seri="grafikSerisi" :bicim="bicim" />
        </section>

        <section class="card min-w-0 p-4 sm:p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink-900">Son siparişler</h2>
            <RouterLink
              :to="{ name: 'store-orders', params }"
              class="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Tümünü gör →
            </RouterLink>
          </div>

          <p v-if="!recent.length" class="py-8 text-center text-sm text-ink-500">Henüz sipariş yok.</p>

          <!-- Dar sütunda tablo yatay kaydırma üretiyordu; liste düzeni
               aynı bilgiyi kaydırmadan veriyor. -->
          <ul v-else class="divide-y divide-ink-100">
            <li v-for="pkg in recent" :key="pkg.packageId">
              <RouterLink
                :to="{ name: 'store-order', params: { ...params, packageId: pkg.packageId } }"
                class="flex items-center gap-3 py-2.5 hover:bg-ink-50"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-ink-800">{{ pkg.orderNumber }}</span>
                  <span class="block truncate text-xs text-ink-500">
                    {{ pkg.customerName }} · {{ formatDate(pkg.placedAt, false) }}
                  </span>
                </span>
                <StatusBadge :map="PACKAGE_STATUS" :value="pkg.status" />
                <span class="shrink-0 text-sm font-medium text-ink-800">{{ money(pkg.subtotal) }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
