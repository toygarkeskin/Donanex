<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money, formatDate, ORDER_STATUS } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import OrderPackages from "../../components/OrderPackages.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const toast = useToastStore();

const order = ref(null);
const loading = ref(true);
const confirming = ref(false);
const cancelling = ref(false);

/** Müşteri yalnızca hazırlanmamış paketleri iptal edebilir. */
const CANCELLABLE = ["pending", "preparing"];

async function load() {
  loading.value = true;
  try {
    order.value = await api.get(`/me/orders/${route.params.orderId}`);
  } finally {
    loading.value = false;
  }
}

async function cancel() {
  cancelling.value = true;
  try {
    const result = await api.post(`/me/orders/${route.params.orderId}/cancel`);
    toast.success(result.message);
    confirming.value = false;
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    cancelling.value = false;
  }
}

onMounted(load);
</script>

<template>
  <LoadingBlock v-if="loading" :rows="4" />

  <div v-else-if="order">
    <PageHeader :title="order.orderNumber" :description="formatDate(order.placedAt)">
      <template #actions>
        <RouterLink :to="{ name: 'account-orders' }" class="btn-secondary">← Siparişlerim</RouterLink>
        <button
          v-if="order.packages.some((p) => CANCELLABLE.includes(p.status))"
          type="button"
          class="btn-danger"
          @click="confirming = true"
        >
          Siparişi iptal et
        </button>
      </template>
    </PageHeader>

    <div class="mb-6 flex flex-wrap items-center gap-4">
      <StatusBadge :map="ORDER_STATUS" :value="order.status" />
      <span class="text-xl font-bold text-ink-900">{{ money(order.total) }}</span>
    </div>

    <AlertBox v-if="order.status === 'pending_payment'" tone="warn" class="mb-6" title="Ödeme bekleniyor">
      Bu siparişin ödemesi tamamlanmadı. Ödeme yapılmazsa sipariş bir süre sonra otomatik iptal edilir
      ve ürünler stoğa geri döner.
    </AlertBox>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <OrderPackages :packages="order.packages" />

      <aside class="card h-fit p-5 text-sm">
        <h2 class="text-base font-semibold text-ink-900">Teslimat</h2>
        <address class="mt-3 not-italic leading-relaxed text-ink-600">
          <p class="font-medium text-ink-800">{{ order.shippingAddress.fullName }}</p>
          <p>{{ order.shippingAddress.line }}</p>
          <p>{{ order.shippingAddress.district }} / {{ order.shippingAddress.city }}</p>
          <p v-if="order.shippingAddress.postalCode">{{ order.shippingAddress.postalCode }}</p>
          <p class="mt-2">{{ order.shippingAddress.phone }}</p>
        </address>

        <template v-if="order.note">
          <hr class="my-4 border-ink-200" />
          <h3 class="font-semibold text-ink-800">Sipariş notu</h3>
          <p class="mt-1 text-ink-600">{{ order.note }}</p>
        </template>
      </aside>
    </div>

    <ConfirmDialog
      :open="confirming"
      :busy="cancelling"
      title="Sipariş iptal edilsin mi?"
      message="Henüz hazırlanmamış paketler iptal edilecek ve ürünler stoğa geri alınacak."
      confirm-label="Siparişi iptal et"
      @confirm="cancel"
      @cancel="confirming = false"
    />
  </div>
</template>
