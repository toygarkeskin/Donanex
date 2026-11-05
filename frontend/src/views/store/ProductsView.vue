<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api, query } from "../../lib/api";
import { money, PRODUCT_STATUS } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";

const route = useRoute();
const toast = useToastStore();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const filters = reactive({ q: "", status: "", page: 1 });
const removing = ref(null);
const busy = ref(false);

const storeId = () => route.params.storeId;

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/stores/${storeId()}/products${query(filters)}`);
  } finally {
    loading.value = false;
  }
}

async function setStatus(product, status) {
  try {
    await api.patch(`/stores/${storeId()}/products/${product.id}/status`, { status });
    toast.success(status === "active" ? "Ürün yayına alındı." : "Ürün durumu güncellendi.");
    await load();
  } catch (error) {
    toast.error(error.message);
  }
}

async function remove() {
  busy.value = true;
  try {
    const result = await api.delete(`/stores/${storeId()}/products/${removing.value.id}`);
    toast.success(result.message);
    removing.value = null;
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    busy.value = false;
  }
}

let debounce;
watch(
  () => filters.q,
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.page = 1;
      load();
    }, 350);
  }
);
watch(() => [filters.status, filters.page], load);
watch(() => route.params.storeId, load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Ürünler" description="Mağazanızın kataloğu.">
      <template #actions>
        <RouterLink :to="{ name: 'store-product-new', params: { storeId: route.params.storeId } }" class="btn-primary">
          + Yeni ürün
        </RouterLink>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap gap-3">
      <input v-model="filters.q" type="search" class="field max-w-xs" placeholder="Ürün ara…" maxlength="100" />
      <select v-model="filters.status" class="field w-auto" aria-label="Durum">
        <option value="">Tüm durumlar</option>
        <option value="active">Yayında</option>
        <option value="draft">Taslak</option>
        <option value="archived">Arşivde</option>
      </select>
    </div>

    <LoadingBlock v-if="loading" :rows="4" />

    <EmptyState
      v-else-if="!result.items.length"
      title="Ürün bulunamadı"
      description="İlk ürününüzü ekleyerek satışa başlayın."
      icon="🏷️"
    >
      <RouterLink :to="{ name: 'store-product-new', params: { storeId: route.params.storeId } }" class="btn-primary">
        Ürün ekle
      </RouterLink>
    </EmptyState>

    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Kategori</th>
              <th class="text-right">Fiyat</th>
              <th class="text-right">Stok</th>
              <th>Durum</th>
              <th class="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in result.items" :key="product.id">
              <td>
                <div class="flex items-center gap-3">
                  <img
                    :src="product.imageUrl"
                    :alt="product.name"
                    class="h-10 w-10 rounded-lg bg-ink-100 object-contain p-0.5"
                    loading="lazy"
                  />
                  <div class="min-w-0">
                    <p class="truncate font-medium text-ink-800">{{ product.name }}</p>
                    <p v-if="product.sku" class="text-xs text-ink-500">{{ product.sku }}</p>
                  </div>
                </div>
              </td>
              <td class="text-ink-600">{{ product.categoryName || "—" }}</td>
              <td class="text-right font-medium">{{ money(product.price) }}</td>
              <td class="text-right">
                <span :class="product.stock <= 3 ? 'font-semibold text-amber-700' : ''">{{ product.stock }}</span>
              </td>
              <td><StatusBadge :map="PRODUCT_STATUS" :value="product.status" /></td>
              <td>
                <div class="flex justify-end gap-1">
                  <RouterLink
                    :to="{ name: 'store-product-edit', params: { storeId: route.params.storeId, productId: product.id } }"
                    class="btn-ghost text-xs"
                  >
                    Düzenle
                  </RouterLink>
                  <button
                    v-if="product.status !== 'active'"
                    type="button"
                    class="btn-ghost text-xs text-emerald-700"
                    @click="setStatus(product, 'active')"
                  >
                    Yayınla
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn-ghost text-xs"
                    @click="setStatus(product, 'draft')"
                  >
                    Yayından kaldır
                  </button>
                  <button type="button" class="btn-ghost text-xs text-red-600" @click="removing = product">
                    Sil
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar
        :page="result.page"
        :pages="result.pages"
        :total="result.total"
        unit="ürün"
        @change="(next) => (filters.page = next)"
      />
    </template>

    <ConfirmDialog
      :open="Boolean(removing)"
      :busy="busy"
      title="Ürün silinsin mi?"
      :message="removing?.hasOrders
        ? 'Bu ürün geçmiş siparişlerde geçiyor. Silinmez, arşive alınır.'
        : 'Ürün kalıcı olarak silinecek.'"
      confirm-label="Devam et"
      @confirm="remove"
      @cancel="removing = null"
    />
  </div>
</template>
