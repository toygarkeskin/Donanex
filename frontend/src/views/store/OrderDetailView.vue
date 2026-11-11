<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { useMagaza } from "../../lib/magaza";
import { money, formatDate, safeUrl, PACKAGE_STATUS, ORDER_STATUS, CARRIERS } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import ProductImage from "../../components/ProductImage.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const { id: storeId, params: magazaParams } = useMagaza();
const toast = useToastStore();

const pkg = ref(null);
const loading = ref(true);
const savingStatus = ref(false);
const savingShipping = ref(false);
const shipping = reactive({ carrier: "", trackingNumber: "", trackingUrl: "" });

/** Paket yaşam döngüsü: her durumdan yalnızca belirli durumlara geçilebilir. */
const NEXT = {
  pending: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: []
};

const nextStatuses = computed(() => NEXT[pkg.value?.status] || []);

async function load() {
  loading.value = true;
  try {
    pkg.value = await api.get(`/stores/${storeId.value}/orders/${route.params.orderNo}`);
    Object.assign(shipping, {
      carrier: pkg.value.carrier || "",
      trackingNumber: pkg.value.trackingNumber || "",
      trackingUrl: pkg.value.trackingUrl || ""
    });
  } finally {
    loading.value = false;
  }
}

async function setStatus(status) {
  savingStatus.value = true;
  try {
    await api.patch(`/stores/${storeId.value}/orders/${route.params.orderNo}/status`, { status });
    toast.success("Paket durumu güncellendi.");
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    savingStatus.value = false;
  }
}

async function saveShipping() {
  savingShipping.value = true;
  try {
    await api.patch(`/stores/${storeId.value}/orders/${route.params.orderNo}/shipping`, {
      carrier: shipping.carrier || null,
      trackingNumber: shipping.trackingNumber || null,
      trackingUrl: shipping.trackingUrl || null
    });
    toast.success("Kargo bilgileri kaydedildi.");
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    savingShipping.value = false;
  }
}

onMounted(load);
</script>

<template>
  <LoadingBlock v-if="loading" :rows="4" />

  <div v-else-if="pkg">
    <PageHeader :title="pkg.orderNumber" :description="formatDate(pkg.placedAt)">
      <template #actions>
        <RouterLink :to="{ name: 'store-orders', params: magazaParams }" class="btn-secondary">
          ← Siparişler
        </RouterLink>
      </template>
    </PageHeader>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <StatusBadge :map="PACKAGE_STATUS" :value="pkg.status" />
      <span class="text-sm text-ink-500">Sipariş durumu:</span>
      <StatusBadge :map="ORDER_STATUS" :value="pkg.orderStatus" />
      <span class="ml-auto text-xl font-bold text-ink-900">{{ money(pkg.subtotal) }}</span>
    </div>

    <AlertBox v-if="pkg.orderStatus === 'pending_payment'" tone="warn" class="mb-6">
      Bu siparişin ödemesi henüz tamamlanmadı. Ödeme alınmadan paketi hazırlamaya başlayamazsınız.
    </AlertBox>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="space-y-6">
        <section class="card overflow-hidden">
          <h2 class="border-b border-ink-100 bg-ink-50 px-4 py-3 text-sm font-semibold text-ink-800">Ürünler</h2>
          <ul class="divide-y divide-ink-100">
            <li v-for="item in pkg.items" :key="item.productId" class="flex items-center gap-3 px-4 py-3">
              <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <ProductImage :src="item.imageUrl" :alt="item.name" padding="p-1" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink-800">{{ item.name }}</p>
                <p class="text-xs text-ink-500">{{ item.quantity }} × {{ money(item.unitPrice) }}</p>
              </div>
              <span class="text-sm font-medium">{{ money(item.lineTotal) }}</span>
            </li>
          </ul>
        </section>

        <section class="card p-5">
          <h2 class="text-base font-semibold text-ink-900">Kargo bilgileri</h2>
          <form class="mt-4 space-y-4" @submit.prevent="saveShipping">
            <div class="grid gap-4 sm:grid-cols-2">
              <FormField id="carrier" label="Kargo firması">
                <select id="carrier" v-model="shipping.carrier" class="field">
                  <option value="">Seçilmedi</option>
                  <option v-for="name in CARRIERS" :key="name" :value="name">{{ name }}</option>
                </select>
              </FormField>
              <FormField id="trackingNumber" label="Takip numarası">
                <input id="trackingNumber" v-model="shipping.trackingNumber" type="text" class="field" maxlength="100" />
              </FormField>
            </div>
            <FormField id="trackingUrl" label="Takip bağlantısı" hint="https:// ile başlamalı.">
              <input id="trackingUrl" v-model="shipping.trackingUrl" type="url" class="field" maxlength="500" />
            </FormField>

            <a
              v-if="safeUrl(pkg.trackingUrl)"
              :href="safeUrl(pkg.trackingUrl)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Kayıtlı takip sayfasını aç →
            </a>

            <button type="submit" class="btn-primary" :disabled="savingShipping">
              {{ savingShipping ? "Kaydediliyor…" : "Kargo bilgilerini kaydet" }}
            </button>
          </form>
        </section>
      </div>

      <aside class="space-y-6">
        <section class="card p-5">
          <h2 class="text-base font-semibold text-ink-900">Durumu ilerlet</h2>
          <div v-if="nextStatuses.length" class="mt-3 flex flex-col gap-2">
            <button
              v-for="status in nextStatuses"
              :key="status"
              type="button"
              class="btn-secondary justify-start"
              :disabled="savingStatus || (pkg.orderStatus === 'pending_payment' && status !== 'cancelled')"
              @click="setStatus(status)"
            >
              {{ PACKAGE_STATUS[status].label }}
            </button>
          </div>
          <p v-else class="mt-3 text-sm text-ink-500">Bu paket son durumunda.</p>
        </section>

        <section class="card p-5 text-sm">
          <h2 class="text-base font-semibold text-ink-900">Teslimat</h2>
          <address class="mt-3 not-italic leading-relaxed text-ink-600">
            <p class="font-medium text-ink-800">{{ pkg.shippingAddress.fullName }}</p>
            <p>{{ pkg.shippingAddress.line }}</p>
            <p>{{ pkg.shippingAddress.district }} / {{ pkg.shippingAddress.city }}</p>
            <p v-if="pkg.shippingAddress.postalCode">{{ pkg.shippingAddress.postalCode }}</p>
            <p class="mt-2">{{ pkg.customerPhone }}</p>
          </address>

          <template v-if="pkg.note">
            <hr class="my-4 border-ink-200" />
            <h3 class="font-semibold text-ink-800">Sipariş notu</h3>
            <p class="mt-1 text-ink-600">{{ pkg.note }}</p>
          </template>
        </section>
      </aside>
    </div>
  </div>
</template>
