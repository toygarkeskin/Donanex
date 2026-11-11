<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { money, formatDate, ORDER_STATUS } from "../../lib/format";
import { seri, egilim, sonHafta } from "../../lib/gosterge";
import PageHeader from "../../components/PageHeader.vue";
import StatCard from "../../components/StatCard.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";
import CizgiGrafik from "../../components/CizgiGrafik.vue";

const summary = ref(null);
const recent = ref([]);
const loading = ref(true);

/*
 * Ölçüt değiştiğinde SUNUCUYA GİDİLMİYOR: on dört günlük seri hem sipariş
 * sayısını hem ciroyu birlikte taşıyor, iki ölçüt de aynı yanıttan çiziliyor.
 */
const olcut = ref("orders");

onMounted(async () => {
  try {
    const [dashboard, orders] = await Promise.all([
      api.get("/admin/dashboard"),
      api.get("/admin/orders?pageSize=6")
    ]);
    summary.value = dashboard;
    recent.value = orders.items ?? [];
  } finally {
    loading.value = false;
  }
});

const gunler = computed(() => summary.value?.last14Days ?? []);
const grafikSerisi = computed(() => seri(gunler.value, olcut.value));

/** Grafiğin üstündeki özet: seçili ölçütün son 7 günlük toplamı. */
const haftalikToplam = computed(() => {
  const toplam = sonHafta(gunler.value, olcut.value);
  return olcut.value === "revenue" ? money(toplam) : `${toplam} sipariş`;
});

const haftalikEgilim = computed(() => egilim(gunler.value, olcut.value));

const bicim = (deger) => (olcut.value === "revenue" ? money(deger) : `${deger} sipariş`);
</script>

<template>
  <div>
    <PageHeader title="Genel bakış" description="Sistemin güncel durumu." />

    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="summary">
      <AlertBox v-if="summary.pendingStores > 0" tone="warn" class="mb-6" title="Onay bekleyen mağaza var">
        {{ summary.pendingStores }} mağaza başvurusu onayınızı bekliyor.
        <RouterLink :to="{ name: 'admin-stores', query: { durum: 'pending' } }" class="font-semibold underline">
          Başvurulara git
        </RouterLink>
      </AlertBox>

      <!--
        Kutular tıklanabilir: sayıyı görüp "peki bunlar hangileri?" diye
        menüden ilgili sayfayı aramak gerekmiyor.
      -->
      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Ödenen hacim"
          :value="money(summary.paidVolume)"
          tone="good"
          icon="panel"
          :trend="egilim(gunler, 'revenue')"
          trend-hint="son 7 gün"
        />
        <StatCard
          label="Toplam sipariş"
          :value="summary.totalOrders"
          icon="kargo"
          :trend="egilim(gunler, 'orders')"
          trend-hint="son 7 gün"
          :to="{ name: 'admin-orders' }"
        />
        <StatCard
          label="Ödeme bekleyen"
          :value="summary.pendingPayment"
          :tone="summary.pendingPayment > 0 ? 'warn' : 'neutral'"
          icon="sepet"
          :to="{ name: 'admin-orders', query: { durum: 'pending_payment' } }"
        />
        <StatCard
          label="Açık destek talebi"
          :value="summary.openTickets"
          :tone="summary.openTickets > 0 ? 'warn' : 'neutral'"
          icon="destek"
          :to="{ name: 'admin-tickets' }"
        />
        <StatCard label="Aktif kullanıcı" :value="summary.activeUsers" icon="kullanicilar" :to="{ name: 'admin-users' }" />
        <StatCard label="Aktif mağaza" :value="summary.activeStores" icon="magaza" :to="{ name: 'admin-stores' }" />
        <StatCard
          label="Onay bekleyen mağaza"
          :value="summary.pendingStores"
          :tone="summary.pendingStores > 0 ? 'warn' : 'neutral'"
          icon="onay"
          :to="{ name: 'admin-stores', query: { durum: 'pending' } }"
        />
        <StatCard label="Yayındaki ürün" :value="summary.activeProducts" icon="etiket" />
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

            <!-- Ölçüt seçici: iki değer de aynı yanıtta geldiği için geçiş anında. -->
            <div class="flex shrink-0 rounded-lg bg-ink-100 p-0.5" role="group" aria-label="Ölçüt">
              <button
                v-for="secenek in [
                  { deger: 'orders', etiket: 'Sipariş' },
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
              :to="{ name: 'admin-orders' }"
              class="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Tümünü gör →
            </RouterLink>
          </div>

          <p v-if="!recent.length" class="py-8 text-center text-sm text-ink-500">Henüz sipariş yok.</p>

          <!--
            Tablo değil liste: bu kutu geniş ekranda bile dar (sağ sütun) ve
            beş sütunlu bir tablo orada yatay kaydırma çubuğu üretiyordu.
          -->
          <ul v-else class="divide-y divide-ink-100">
            <li v-for="order in recent" :key="order.id">
              <RouterLink
                :to="{ name: 'admin-order', params: { orderNo: order.orderNumber } }"
                class="flex items-center gap-3 py-2.5 hover:bg-ink-50"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-ink-800">{{ order.orderNumber }}</span>
                  <span class="block truncate text-xs text-ink-500">
                    {{ order.customerName }} · {{ formatDate(order.placedAt, false) }}
                  </span>
                </span>
                <StatusBadge :map="ORDER_STATUS" :value="order.status" />
                <span class="shrink-0 text-sm font-medium text-ink-800">{{ money(order.total) }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
