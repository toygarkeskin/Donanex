<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../../lib/api";
import { toAmount } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const isEdit = computed(() => Boolean(route.params.productId));
const storeId = () => route.params.storeId;

const form = reactive({
  name: "",
  description: "",
  price: "",
  stock: 0,
  imageUrl: "",
  sku: "",
  categoryId: "",
  status: "draft"
});

const categories = ref([]);
const saving = ref(false);
const error = ref("");
const loading = ref(true);

async function load() {
  try {
    categories.value = (await api.get("/categories")).items;

    if (isEdit.value) {
      // Panel listesi üzerinden ürünü bul: ayrı bir uç açmadan düzenleme.
      const result = await api.get(`/stores/${storeId()}/products?pageSize=100`);
      const product = result.items.find((item) => item.id === route.params.productId);
      if (!product) {
        error.value = "Ürün bulunamadı.";
        return;
      }
      Object.assign(form, {
        name: product.name,
        description: product.description,
        price: toAmount(product.price),
        stock: product.stock,
        imageUrl: product.imageUrl,
        sku: product.sku || "",
        categoryId: product.categoryId || "",
        status: product.status
      });
    }
  } finally {
    loading.value = false;
  }
}

async function submit() {
  error.value = "";
  saving.value = true;
  try {
    const payload = { ...form, categoryId: form.categoryId || null, sku: form.sku || null };
    const result = isEdit.value
      ? await api.put(`/stores/${storeId()}/products/${route.params.productId}`, payload)
      : await api.post(`/stores/${storeId()}/products`, payload);

    toast.success(result.message);
    router.push({ name: "store-products", params: { storeId: storeId() } });
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-3xl">
    <PageHeader :title="isEdit ? 'Ürünü düzenle' : 'Yeni ürün'">
      <template #actions>
        <RouterLink :to="{ name: 'store-products', params: { storeId: route.params.storeId } }" class="btn-secondary">
          ← Ürünler
        </RouterLink>
      </template>
    </PageHeader>

    <AlertBox v-if="error" tone="error" class="mb-6">{{ error }}</AlertBox>

    <form v-if="!loading" class="card space-y-4 p-5" @submit.prevent="submit">
      <FormField id="name" label="Ürün adı" required>
        <input id="name" v-model="form.name" type="text" class="field" required maxlength="250" />
      </FormField>

      <FormField id="description" label="Açıklama" required>
        <textarea id="description" v-model="form.description" rows="5" class="field" required maxlength="5000" />
      </FormField>

      <div class="grid gap-4 sm:grid-cols-3">
        <FormField id="price" label="Fiyat (TL)" required hint="Örnek: 199.90">
          <input id="price" v-model="form.price" type="text" inputmode="decimal" class="field" required />
        </FormField>
        <FormField id="stock" label="Stok adedi" required>
          <input id="stock" v-model.number="form.stock" type="number" min="0" class="field" required />
        </FormField>
        <FormField id="sku" label="Stok kodu">
          <input id="sku" v-model="form.sku" type="text" class="field" maxlength="60" />
        </FormField>
      </div>

      <FormField
        id="imageUrl"
        label="Görsel adresi"
        required
        hint="/images/… ile başlayan yerel bir yol ya da https:// ile başlayan bir adres."
      >
        <input id="imageUrl" v-model="form.imageUrl" type="text" class="field" required maxlength="500" />
      </FormField>

      <div v-if="form.imageUrl" class="flex items-center gap-3">
        <img :src="form.imageUrl" alt="Önizleme" class="h-24 w-24 rounded-lg border border-ink-200 object-contain p-1" />
        <span class="text-xs text-ink-500">Görsel önizlemesi</span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField id="categoryId" label="Kategori">
          <select id="categoryId" v-model="form.categoryId" class="field">
            <option value="">Seçilmedi</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </FormField>
        <FormField id="status" label="Durum" hint="Taslak ürünler vitrinde görünmez.">
          <select id="status" v-model="form.status" class="field">
            <option value="draft">Taslak</option>
            <option value="active">Yayında</option>
            <option value="archived">Arşivde</option>
          </select>
        </FormField>
      </div>

      <div class="flex gap-2 pt-2">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? "Kaydediliyor…" : isEdit ? "Değişiklikleri kaydet" : "Ürünü oluştur" }}
        </button>
        <RouterLink :to="{ name: 'store-products', params: { storeId: route.params.storeId } }" class="btn-secondary">
          Vazgeç
        </RouterLink>
      </div>
    </form>
  </div>
</template>
