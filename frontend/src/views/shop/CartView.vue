<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { money } from "../../lib/format";
import { useCartStore } from "../../stores/cart";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import EmptyState from "../../components/EmptyState.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";

const cart = useCartStore();
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();

const busy = ref(null);
const confirmClear = ref(false);

const ISSUES = {
  removed: "Bu ürün kaldırılmış.",
  unavailable: "Bu ürün şu anda satışta değil.",
  insufficient_stock: "Stok yetersiz, adedi azaltın."
};

async function change(productId, quantity) {
  if (quantity < 1) return;
  busy.value = productId;
  try {
    await cart.setQuantity(productId, quantity);
  } catch (error) {
    toast.error(error.message);
  } finally {
    busy.value = null;
  }
}

async function remove(productId) {
  busy.value = productId;
  try {
    await cart.remove(productId);
  } catch (error) {
    toast.error(error.message);
  } finally {
    busy.value = null;
  }
}

async function clearAll() {
  try {
    await cart.clear();
    toast.info("Sepetiniz boşaltıldı.");
  } catch (error) {
    toast.error(error.message);
  } finally {
    confirmClear.value = false;
  }
}

onMounted(() => cart.load().catch(() => {}));
</script>

<template>
  <div>
    <PageHeader title="Sepetim" :description="cart.itemCount ? `${cart.itemCount} ürün` : ''" />

    <LoadingBlock v-if="cart.loading && !cart.loaded" :rows="3" />

    <EmptyState
      v-else-if="!cart.items.length"
      title="Sepetiniz boş"
      description="Ürünleri gezip sepetinize ekleyebilirsiniz. Üye olmanıza gerek yok."
      icon="🛍️"
    >
      <RouterLink :to="{ name: 'products' }" class="btn-primary">Ürünlere git</RouterLink>
    </EmptyState>

    <div v-else class="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div class="space-y-3">
        <AlertBox v-if="cart.hasIssues" tone="warn" title="Sepetinizde dikkat etmeniz gereken ürünler var">
          Aşağıda işaretli satırları düzeltmeden siparişi tamamlayamazsınız.
        </AlertBox>

        <article
          v-for="item in cart.items"
          :key="item.productId"
          class="card flex flex-wrap items-center gap-4 p-4"
          :class="{ 'border-amber-300 bg-amber-50/40': !item.available }"
        >
          <img
            v-if="item.imageUrl"
            :src="item.imageUrl"
            :alt="item.name"
            class="h-20 w-20 shrink-0 rounded-lg bg-ink-100 object-contain p-1"
          />
          <div v-else class="h-20 w-20 shrink-0 rounded-lg bg-ink-100" />

          <div class="min-w-50 flex-1">
            <RouterLink
              v-if="item.slug"
              :to="{ name: 'product', params: { storeSlug: item.storeSlug, productSlug: item.slug } }"
              class="text-sm font-semibold text-ink-800 hover:text-brand-600"
            >
              {{ item.name }}
            </RouterLink>
            <p v-else class="text-sm font-semibold text-ink-500">Kaldırılmış ürün</p>

            <p v-if="item.storeName" class="text-xs text-ink-500">{{ item.storeName }}</p>
            <p v-if="!item.available" class="mt-1 text-xs font-medium text-amber-800">
              {{ ISSUES[item.issue] || "Bu ürün sipariş edilemiyor." }}
            </p>
          </div>

          <p v-if="item.unitPrice" class="w-24 text-sm text-ink-600">{{ money(item.unitPrice) }}</p>

          <div v-if="item.available || item.issue === 'insufficient_stock'" class="flex items-center gap-1">
            <button
              type="button"
              class="btn-secondary h-9 w-9 p-0"
              :disabled="busy === item.productId || item.quantity <= 1"
              aria-label="Azalt"
              @click="change(item.productId, item.quantity - 1)"
            >
              −
            </button>
            <span class="w-10 text-center text-sm font-semibold">{{ item.quantity }}</span>
            <button
              type="button"
              class="btn-secondary h-9 w-9 p-0"
              :disabled="busy === item.productId || item.quantity >= item.stock"
              aria-label="Artır"
              @click="change(item.productId, item.quantity + 1)"
            >
              +
            </button>
          </div>

          <p v-if="item.lineTotal" class="w-28 text-right text-sm font-bold text-ink-900">
            {{ money(item.lineTotal) }}
          </p>

          <button
            type="button"
            class="btn-ghost text-red-600"
            :disabled="busy === item.productId"
            @click="remove(item.productId)"
          >
            Kaldır
          </button>
        </article>

        <button type="button" class="btn-ghost text-red-600" @click="confirmClear = true">Sepeti boşalt</button>
      </div>

      <aside class="card h-fit p-5">
        <h2 class="text-base font-semibold text-ink-900">Sipariş özeti</h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-ink-500">Ara toplam</dt>
            <dd class="font-medium">{{ money(cart.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-ink-500">Kargo</dt>
            <dd class="font-medium text-emerald-700">Ücretsiz</dd>
          </div>
        </dl>
        <hr class="my-4 border-ink-200" />
        <div class="flex items-baseline justify-between">
          <span class="text-sm text-ink-500">Toplam</span>
          <span class="text-xl font-bold text-ink-900">{{ money(cart.subtotal) }}</span>
        </div>

        <button
          type="button"
          class="btn-primary mt-5 w-full"
          :disabled="!cart.canCheckout"
          @click="router.push({ name: 'checkout' })"
        >
          Siparişi tamamla
        </button>

        <p v-if="!auth.isSignedIn" class="mt-4 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
          Üye olmadan da sipariş verebilirsiniz.
          <RouterLink :to="{ name: 'register', query: { donus: '/sepet' } }" class="font-semibold text-brand-600">
            Kayıt olursanız
          </RouterLink>
          sepetiniz korunur, siparişlerinizi takip kodu olmadan görebilir ve adreslerinizi kaydedebilirsiniz.
        </p>
      </aside>
    </div>

    <ConfirmDialog
      :open="confirmClear"
      title="Sepet boşaltılsın mı?"
      message="Sepetinizdeki tüm ürünler kaldırılacak."
      confirm-label="Boşalt"
      @confirm="clearAll"
      @cancel="confirmClear = false"
    />
  </div>
</template>
