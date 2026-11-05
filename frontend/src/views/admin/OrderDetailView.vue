<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money, formatDate, ORDER_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import OrderPackages from "../../components/OrderPackages.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";

const route = useRoute();
const order = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    order.value = await api.get(`/admin/orders/${route.params.orderId}`);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <LoadingBlock v-if="loading" :rows="4" />

  <div v-else-if="order">
    <PageHeader :title="order.orderNumber" :description="formatDate(order.placedAt)">
      <template #actions>
        <RouterLink :to="{ name: 'admin-orders' }" class="btn-secondary">← Siparişler</RouterLink>
      </template>
    </PageHeader>

    <div class="mb-6 flex flex-wrap items-center gap-4">
      <StatusBadge :map="ORDER_STATUS" :value="order.status" />
      <span class="text-xl font-bold text-ink-900">{{ money(order.total) }}</span>
      <span v-if="!order.userId" class="rounded bg-ink-100 px-2 py-1 text-xs text-ink-600">Misafir siparişi</span>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <OrderPackages :packages="order.packages" />

      <aside class="space-y-6">
        <section class="card p-5 text-sm">
          <h2 class="text-base font-semibold text-ink-900">Müşteri</h2>
          <dl class="mt-3 space-y-1 text-ink-600">
            <div><dt class="inline text-ink-500">Ad:</dt> <dd class="inline font-medium text-ink-800">{{ order.contactFullName }}</dd></div>
            <div><dt class="inline text-ink-500">E-posta:</dt> <dd class="inline">{{ order.contactEmail }}</dd></div>
            <div><dt class="inline text-ink-500">Telefon:</dt> <dd class="inline">{{ order.contactPhone }}</dd></div>
          </dl>

          <hr class="my-4 border-ink-200" />
          <h3 class="font-semibold text-ink-800">Teslimat adresi</h3>
          <address class="mt-2 not-italic leading-relaxed text-ink-600">
            <p>{{ order.shippingAddress.line }}</p>
            <p>{{ order.shippingAddress.district }} / {{ order.shippingAddress.city }}</p>
          </address>

          <template v-if="order.note">
            <hr class="my-4 border-ink-200" />
            <h3 class="font-semibold text-ink-800">Sipariş notu</h3>
            <p class="mt-1 text-ink-600">{{ order.note }}</p>
          </template>
        </section>

        <section class="card p-5 text-sm">
          <h2 class="text-base font-semibold text-ink-900">Ödeme kayıtları</h2>
          <p v-if="!order.payments.length" class="mt-2 text-ink-500">Ödeme denemesi yok.</p>
          <ul v-else class="mt-3 space-y-3">
            <li v-for="payment in order.payments" :key="payment.reference" class="rounded-lg bg-ink-50 p-3">
              <p class="font-medium" :class="payment.status === 'succeeded' ? 'text-emerald-700' : 'text-red-700'">
                {{ payment.status === "succeeded" ? "Başarılı" : "Başarısız" }} · {{ money(payment.amount) }}
              </p>
              <p class="text-xs text-ink-500">{{ payment.provider }} · {{ payment.reference }}</p>
              <p class="text-xs text-ink-500">{{ formatDate(payment.createdAt) }}</p>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
