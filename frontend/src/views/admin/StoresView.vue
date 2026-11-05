<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api, query } from "../../lib/api";
import { formatDate, STORE_STATUS } from "../../lib/format";
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
const filters = reactive({ q: "", status: route.query.durum || "", page: 1 });
const pending = ref(null);
const busy = ref(false);

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/admin/stores${query(filters)}`);
  } finally {
    loading.value = false;
  }
}

function ask(store, status) {
  pending.value = { store, status };
}

async function apply() {
  busy.value = true;
  try {
    const response = await api.patch(`/admin/stores/${pending.value.store.id}/status`, {
      status: pending.value.status
    });
    toast.success(response.message);
    pending.value = null;
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
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Mağazalar" description="Başvuruları onaylayın, mağazaları yönetin." />

    <div class="mb-4 flex flex-wrap gap-3">
      <input v-model="filters.q" type="search" class="field max-w-xs" placeholder="Mağaza veya sahip ara…" />
      <select v-model="filters.status" class="field w-auto" aria-label="Durum">
        <option value="">Tüm durumlar</option>
        <option v-for="(meta, key) in STORE_STATUS" :key="key" :value="key">{{ meta.label }}</option>
      </select>
    </div>

    <LoadingBlock v-if="loading" :rows="4" />
    <EmptyState v-else-if="!result.items.length" title="Mağaza bulunamadı" icon="🏪" />

    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Sahibi</th>
              <th class="text-right">Ürün</th>
              <th class="text-right">Sipariş</th>
              <th>Başvuru</th>
              <th>Durum</th>
              <th class="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="store in result.items" :key="store.id">
              <td>
                <p class="font-medium text-ink-800">{{ store.name }}</p>
                <p class="text-xs text-ink-500">{{ store.contactEmail }}</p>
              </td>
              <td>
                <p class="text-sm">{{ store.ownerName }}</p>
                <p class="text-xs text-ink-500">{{ store.ownerEmail }}</p>
              </td>
              <td class="text-right">{{ store.productCount }}</td>
              <td class="text-right">{{ store.orderCount }}</td>
              <td class="whitespace-nowrap text-ink-500">{{ formatDate(store.createdAt, false) }}</td>
              <td><StatusBadge :map="STORE_STATUS" :value="store.status" /></td>
              <td>
                <div class="flex justify-end gap-1">
                  <button
                    v-if="store.status !== 'active'"
                    type="button"
                    class="btn-ghost text-xs text-emerald-700"
                    @click="ask(store, 'active')"
                  >
                    {{ store.status === "pending" ? "Onayla" : "Aktifleştir" }}
                  </button>
                  <button
                    v-if="store.status !== 'suspended'"
                    type="button"
                    class="btn-ghost text-xs text-red-600"
                    @click="ask(store, 'suspended')"
                  >
                    Askıya al
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
        unit="mağaza"
        @change="(next) => (filters.page = next)"
      />
    </template>

    <ConfirmDialog
      :open="Boolean(pending)"
      :busy="busy"
      :title="pending?.status === 'active' ? 'Mağaza onaylansın mı?' : 'Mağaza askıya alınsın mı?'"
      :message="pending?.status === 'active'
        ? `${pending?.store.name} satış yapabilecek ve sahibine mağaza yetkisi verilecek.`
        : `${pending?.store.name} mağazasının ürünleri vitrinden kaldırılacak.`"
      :tone="pending?.status === 'active' ? 'primary' : 'danger'"
      :confirm-label="pending?.status === 'active' ? 'Onayla' : 'Askıya al'"
      @confirm="apply"
      @cancel="pending = null"
    />
  </div>
</template>
