<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { useCartStore } from "../../stores/cart";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";
import EmptyState from "../../components/EmptyState.vue";

const cart = useCartStore();
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();

const form = reactive({
  email: "",
  fullName: "",
  phone: "",
  city: "",
  district: "",
  line: "",
  postalCode: "",
  note: ""
});

const addresses = ref([]);
const submitting = ref(false);
const error = ref("");

/** Kayıtlı adres seçilince form doldurulur. */
function useAddress(address) {
  Object.assign(form, {
    fullName: address.fullName,
    phone: address.phone,
    city: address.city,
    district: address.district,
    line: address.line,
    postalCode: address.postalCode || ""
  });
}

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    const result = await api.post("/orders", {
      contact: { email: form.email, fullName: form.fullName, phone: form.phone },
      shippingAddress: {
        fullName: form.fullName,
        phone: form.phone,
        city: form.city,
        district: form.district,
        line: form.line,
        postalCode: form.postalCode || null
      },
      note: form.note || null
    });

    cart.reset();
    // Takip kodu yalnızca bu yanıtta açık gelir; ödeme ekranına taşınır.
    sessionStorage.setItem(
      `donanex.order.${result.orderId}`,
      JSON.stringify({ trackingCode: result.trackingCode, orderNumber: result.orderNumber })
    );
    router.push({ name: "payment", params: { orderId: result.orderId } });
  } catch (requestError) {
    error.value = requestError.message;
    toast.error(requestError.message);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await cart.load().catch(() => {});

  if (auth.isSignedIn) {
    form.email = auth.user.email;
    form.fullName = auth.user.fullName;
    form.phone = auth.user.phone || "";
    try {
      const saved = await api.get("/me/addresses");
      addresses.value = saved.items;
      if (saved.items.length) useAddress(saved.items[0]);
    } catch {
      /* adres yoksa form elle doldurulur */
    }
  }
});
</script>

<template>
  <div>
    <PageHeader title="Siparişi tamamla" description="Teslimat ve iletişim bilgilerinizi girin." />

    <EmptyState
      v-if="cart.loaded && !cart.items.length"
      title="Sepetiniz boş"
      description="Sipariş verebilmek için önce sepetinize ürün ekleyin."
      icon="🛍️"
    >
      <RouterLink :to="{ name: 'products' }" class="btn-primary">Ürünlere git</RouterLink>
    </EmptyState>

    <form v-else class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" @submit.prevent="submit">
      <div class="space-y-6">
        <AlertBox v-if="!auth.isSignedIn" tone="info" title="Üye olmadan devam ediyorsunuz">
          Siparişinizi takip edebilmeniz için size tek kullanımlık bir takip kodu vereceğiz.
          <RouterLink :to="{ name: 'register', query: { donus: '/odeme' } }" class="font-semibold underline">
            Kayıt olursanız
          </RouterLink>
          sepetiniz korunur ve siparişleriniz hesabınızda görünür.
        </AlertBox>

        <AlertBox v-if="error" tone="error">{{ error }}</AlertBox>

        <section class="card p-5">
          <h2 class="mb-4 text-base font-semibold text-ink-900">İletişim bilgileri</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField id="email" label="E-posta" required hint="Sipariş bilgileri bu adrese gönderilir.">
              <input id="email" v-model="form.email" type="email" class="field" required maxlength="254" autocomplete="email" />
            </FormField>
            <FormField id="phone" label="Telefon" required>
              <input id="phone" v-model="form.phone" type="tel" class="field" required maxlength="30" autocomplete="tel" />
            </FormField>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-ink-900">Teslimat adresi</h2>
            <div v-if="addresses.length" class="flex flex-wrap gap-2">
              <button
                v-for="address in addresses"
                :key="address.id"
                type="button"
                class="btn-secondary text-xs"
                @click="useAddress(address)"
              >
                {{ address.title }}
              </button>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <FormField id="fullName" label="Ad Soyad" required>
              <input id="fullName" v-model="form.fullName" type="text" class="field" required maxlength="150" autocomplete="name" />
            </FormField>
            <FormField id="city" label="İl" required>
              <input id="city" v-model="form.city" type="text" class="field" required maxlength="80" />
            </FormField>
            <FormField id="district" label="İlçe" required>
              <input id="district" v-model="form.district" type="text" class="field" required maxlength="80" />
            </FormField>
            <FormField id="postalCode" label="Posta kodu">
              <input id="postalCode" v-model="form.postalCode" type="text" class="field" maxlength="20" />
            </FormField>
            <div class="sm:col-span-2">
              <FormField id="line" label="Açık adres" required>
                <textarea id="line" v-model="form.line" rows="3" class="field" required maxlength="500" />
              </FormField>
            </div>
            <div class="sm:col-span-2">
              <FormField id="note" label="Sipariş notu">
                <textarea id="note" v-model="form.note" rows="2" class="field" maxlength="500" placeholder="İsteğe bağlı" />
              </FormField>
            </div>
          </div>
        </section>
      </div>

      <aside class="card h-fit p-5">
        <h2 class="text-base font-semibold text-ink-900">Özet</h2>
        <ul class="mt-4 space-y-3 text-sm">
          <li v-for="item in cart.items" :key="item.productId" class="flex justify-between gap-3">
            <span class="min-w-0 flex-1 truncate text-ink-600">{{ item.name }} × {{ item.quantity }}</span>
            <span class="font-medium">{{ money(item.lineTotal) }}</span>
          </li>
        </ul>
        <hr class="my-4 border-ink-200" />
        <div class="flex items-baseline justify-between">
          <span class="text-sm text-ink-500">Toplam</span>
          <span class="text-xl font-bold text-ink-900">{{ money(cart.subtotal) }}</span>
        </div>

        <button type="submit" class="btn-primary mt-5 w-full" :disabled="submitting || !cart.canCheckout">
          {{ submitting ? "Sipariş oluşturuluyor…" : "Siparişi oluştur" }}
        </button>
        <p class="mt-3 text-center text-xs text-ink-400">Sonraki adımda ödeme ekranına yönlendirileceksiniz.</p>
      </aside>
    </form>
  </div>
</template>
