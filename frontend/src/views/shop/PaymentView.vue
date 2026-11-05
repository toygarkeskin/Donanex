<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { useCartStore } from "../../stores/cart";
import { useToastStore } from "../../stores/toast";
import AlertBox from "../../components/AlertBox.vue";
import PageHeader from "../../components/PageHeader.vue";

const route = useRoute();
const auth = useAuthStore();
const cart = useCartStore();
const toast = useToastStore();

const saved = ref(null);
const result = ref(null);
const processing = ref(false);
const copied = ref(false);

/**
 * Takip kodu yalnızca sipariş yanıtında açık gelir ve sessionStorage'da
 * bu sekme için saklanır. Sunucuda yalnızca özeti vardır.
 */
onMounted(() => {
  const stored = sessionStorage.getItem(`pazar.order.${route.params.orderId}`);
  if (stored) saved.value = JSON.parse(stored);
  cart.load().catch(() => {});
});

async function pay(outcome) {
  processing.value = true;
  try {
    result.value = await api.post(`/orders/${route.params.orderId}/payment`, {
      outcome,
      trackingCode: saved.value?.trackingCode ?? null
    });
    await cart.load().catch(() => {});
    toast[outcome === "success" ? "success" : "info"](
      outcome === "success" ? "Ödeme alındı." : "Ödeme başarısız olarak işaretlendi, stok iade edildi."
    );
  } catch (error) {
    toast.error(error.message);
  } finally {
    processing.value = false;
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(saved.value.trackingCode);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2500);
  } catch {
    toast.info("Kodu seçip kopyalayabilirsiniz.");
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader title="Ödeme" :description="saved ? `Sipariş ${saved.orderNumber}` : ''" />

    <AlertBox tone="warn" title="Bu bir ödeme benzetimidir">
      Gerçek bir ödeme sağlayıcısı bağlı değildir ve hiçbir para hareketi olmaz.
      <strong>Kart bilgisi girmeyin.</strong> Aşağıdan sonucu siz seçersiniz; sistem gerçek bir ödeme
      dönmüş gibi davranır.
    </AlertBox>

    <div v-if="saved" class="card mt-6 p-5">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-500">Sipariş takip kodunuz</h2>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <code class="flex-1 break-all rounded-lg bg-ink-100 px-3 py-2 font-mono text-sm">
          {{ saved.trackingCode }}
        </code>
        <button type="button" class="btn-secondary" @click="copyCode">
          {{ copied ? "Kopyalandı" : "Kopyala" }}
        </button>
      </div>
      <p class="mt-2 text-xs text-ink-500">
        Bu kodu saklayın. Üye değilseniz siparişinizi görmek için sipariş numarası ile birlikte gerekir.
      </p>
    </div>

    <AlertBox v-else tone="warn" class="mt-6">
      Bu siparişin takip kodu bu sekmede bulunamadı. Ödeme yapabilmek için siparişi oluşturduğunuz
      sekmeyi kullanın ya da giriş yaparak
      <RouterLink :to="{ name: 'account-orders' }" class="font-semibold underline">siparişlerinizden</RouterLink>
      devam edin.
    </AlertBox>

    <div v-if="!result" class="mt-6 flex flex-col gap-3">
      <button type="button" class="btn-primary py-3" :disabled="processing" @click="pay('success')">
        {{ processing ? "İşleniyor…" : "Ödemeyi başarılı tamamla" }}
      </button>
      <button type="button" class="btn-secondary py-3" :disabled="processing" @click="pay('failure')">
        Ödemeyi başarısız olarak dene
      </button>
    </div>

    <div v-else class="mt-6 space-y-4">
      <AlertBox :tone="result.status === 'paid' ? 'success' : 'error'">
        <p v-if="result.status === 'paid'" class="font-semibold">
          Ödeme alındı — sipariş {{ result.orderNumber }} onaylandı.
        </p>
        <p v-else class="font-semibold">
          Ödeme tamamlanamadı. Sipariş iptal edildi ve ürünler stoğa geri alındı.
        </p>
      </AlertBox>

      <div class="flex flex-wrap gap-3">
        <RouterLink v-if="auth.isSignedIn" :to="{ name: 'account-orders' }" class="btn-primary">
          Siparişlerime git
        </RouterLink>
        <RouterLink
          v-else-if="saved"
          :to="{ name: 'track', query: { no: saved.orderNumber } }"
          class="btn-primary"
        >
          Siparişimi takip et
        </RouterLink>
        <RouterLink :to="{ name: 'products' }" class="btn-secondary">Alışverişe devam et</RouterLink>
      </div>

      <p v-if="!auth.isSignedIn" class="rounded-lg bg-ink-50 p-4 text-sm text-ink-600">
        <RouterLink :to="{ name: 'register' }" class="font-semibold text-brand-600">Hesap oluşturursanız</RouterLink>
        bundan sonraki siparişlerinizi takip kodu olmadan görebilir, adreslerinizi kaydedebilirsiniz.
      </p>
    </div>
  </div>
</template>
