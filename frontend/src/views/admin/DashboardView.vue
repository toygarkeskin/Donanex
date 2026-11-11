<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import StatCard from "../../components/StatCard.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";

const summary = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    summary.value = await api.get("/admin/dashboard");
  } finally {
    loading.value = false;
  }
});

/** Basit sütun grafiği: günlük sipariş sayısı, en yüksek güne göre ölçeklenir. */
const chart = computed(() => {
  const days = summary.value?.last14Days ?? [];
  const peak = Math.max(1, ...days.map((day) => day.orders));
  return days.map((day) => ({
    ...day,
    height: Math.round((day.orders / peak) * 100),
    label: new Date(day.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
  }));
});
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

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Aktif kullanıcı" :value="summary.activeUsers" />
        <StatCard label="Aktif mağaza" :value="summary.activeStores" />
        <StatCard
          label="Onay bekleyen mağaza"
          :value="summary.pendingStores"
          :tone="summary.pendingStores > 0 ? 'warn' : 'neutral'"
        />
        <StatCard label="Yayındaki ürün" :value="summary.activeProducts" />
        <StatCard label="Toplam sipariş" :value="summary.totalOrders" />
        <StatCard
          label="Ödeme bekleyen"
          :value="summary.pendingPayment"
          :tone="summary.pendingPayment > 0 ? 'warn' : 'neutral'"
        />
        <StatCard label="Ödenen hacim" :value="money(summary.paidVolume)" tone="good" />
        <StatCard
          label="Açık destek talebi"
          :value="summary.openTickets"
          :tone="summary.openTickets > 0 ? 'warn' : 'neutral'"
        />
      </div>

      <section class="card mt-8 p-5">
        <h2 class="text-base font-semibold text-ink-900">Son 14 gün</h2>
        <p class="text-sm text-ink-500">Günlük sipariş sayısı</p>

        <div class="mt-6 flex h-40 items-end gap-2">
          <div v-for="day in chart" :key="day.date" class="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
            <span class="text-xs font-medium text-ink-600">{{ day.orders || "" }}</span>
            <!--
              Çubuğun yüzde yüksekliği, ancak saran kutunun yüksekliği BELİRLİ
              olduğunda çözülür. Bu aradaki "flex-1" kutu o yüksekliği verir;
              olmadığında yüzde otomatik yüksekliğe çözülüp çubuk kayboluyordu.
            -->
            <div class="flex w-full flex-1 items-end">
              <div
                class="w-full rounded-t bg-brand-500 transition-all"
                :style="{ height: `${Math.max(day.height, day.orders ? 6 : 2)}%` }"
                :title="`${day.label}: ${day.orders} sipariş`"
              />
            </div>
            <span class="truncate text-[10px] text-ink-400">{{ day.label }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
