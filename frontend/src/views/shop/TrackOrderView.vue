<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money, formatDate, ORDER_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import OrderPackages from "../../components/OrderPackages.vue";

const route = useRoute();
const form = reactive({ orderNumber: route.query.no || "", trackingCode: "" });
const order = ref(null);
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  order.value = null;
  loading.value = true;
  try {
    order.value = await api.post("/orders/track", {
      orderNumber: form.orderNumber.trim().toUpperCase(),
      trackingCode: form.trackingCode.trim()
    });
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  // Ödeme ekranı takip kodunu bu sekmede bırakmış olabilir.
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith("pazar.order.")) continue;
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (!form.orderNumber || saved.orderNumber === form.orderNumber) {
      form.orderNumber = saved.orderNumber;
      form.trackingCode = saved.trackingCode;
      break;
    }
  }
});
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader
      title="Sipariş takibi"
      description="Üye değilseniz sipariş numaranız ve takip kodunuzla siparişinizi görebilirsiniz."
    />

    <form class="card space-y-4 p-5" @submit.prevent="submit">
      <FormField id="orderNumber" label="Sipariş numarası" required hint="Örnek: PZ-2026-001234">
        <input id="orderNumber" v-model="form.orderNumber" type="text" class="field" required maxlength="30" />
      </FormField>
      <FormField id="trackingCode" label="Takip kodu" required hint="Sipariş sonrası size verilen uzun kod.">
        <input id="trackingCode" v-model="form.trackingCode" type="text" class="field font-mono" required maxlength="64" />
      </FormField>
      <button type="submit" class="btn-primary" :disabled="loading">
        {{ loading ? "Sorgulanıyor…" : "Siparişi sorgula" }}
      </button>
    </form>

    <AlertBox v-if="error" tone="error" class="mt-4">{{ error }}</AlertBox>

    <section v-if="order" class="mt-6">
      <div class="card mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p class="text-lg font-bold text-ink-900">{{ order.orderNumber }}</p>
          <p class="text-sm text-ink-500">{{ formatDate(order.placedAt) }}</p>
        </div>
        <div class="flex items-center gap-3">
          <StatusBadge :map="ORDER_STATUS" :value="order.status" />
          <span class="text-lg font-bold text-ink-900">{{ money(order.total) }}</span>
        </div>
      </div>

      <OrderPackages :packages="order.packages" />
    </section>
  </div>
</template>
