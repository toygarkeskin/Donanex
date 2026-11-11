<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { api, query } from "../../lib/api";
import { formatDate, ROLE_LABELS, USER_STATUS } from "../../lib/format";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";
import AlertBox from "../../components/AlertBox.vue";

const auth = useAuthStore();
const toast = useToastStore();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const filters = reactive({ q: "", role: "", status: "", page: 1 });
const pending = ref(null);
const busy = ref(false);

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/admin/users${query(filters)}`);
  } finally {
    loading.value = false;
  }
}

async function applyStatus() {
  busy.value = true;
  try {
    const response = await api.patch(`/admin/users/${pending.value.user.id}/status`, {
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

async function toggleAdmin(user, revoke) {
  try {
    const response = await api.post(`/admin/users/${user.id}/roles`, {
      roleCode: "SYSTEM_ADMIN",
      revoke
    });
    toast.success(response.message);
    await load();
  } catch (error) {
    toast.error(error.message);
  }
}

const isAdmin = (user) => user.roles.some((role) => role.roleCode === "SYSTEM_ADMIN");

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
watch(() => [filters.role, filters.status, filters.page], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Kullanıcılar" description="Hesapları ve rolleri yönetin." />

    <AlertBox tone="info" class="mb-6">
      Mağazaya bağlı roller (Mağaza Sahibi, Mağaza Çalışanı) mağaza panelinden yönetilir.
      Buradan yalnızca sistem geneli yetki verilir.
    </AlertBox>

    <div class="mb-4 flex flex-wrap gap-3">
      <input v-model="filters.q" type="search" class="field max-w-xs" placeholder="Ad veya e-posta ara…" />
      <select v-model="filters.role" class="field w-auto" aria-label="Rol">
        <option value="">Tüm roller</option>
        <option v-for="(label, code) in ROLE_LABELS" :key="code" :value="code">{{ label }}</option>
      </select>
      <select v-model="filters.status" class="field w-auto" aria-label="Durum">
        <option value="">Tüm durumlar</option>
        <option v-for="(meta, key) in USER_STATUS" :key="key" :value="key">{{ meta.label }}</option>
      </select>
    </div>

    <LoadingBlock v-if="loading" :rows="4" />
    <EmptyState v-else-if="!result.items.length" title="Kullanıcı bulunamadı" icon="kullanicilar" />

    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Roller</th>
              <th>Kayıt</th>
              <th>Son giriş</th>
              <th>Durum</th>
              <th class="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in result.items" :key="user.id">
              <td>
                <p class="font-medium text-ink-800">
                  {{ user.fullName }}
                  <span v-if="user.id === auth.user?.id" class="text-xs text-ink-400">(siz)</span>
                </p>
                <p class="text-xs text-ink-500">
                  {{ user.email }}
                  <span v-if="!user.emailVerified" class="text-amber-700">· doğrulanmadı</span>
                </p>
              </td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="role in user.roles"
                    :key="`${role.roleCode}-${role.storeId}`"
                    class="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600"
                  >
                    {{ ROLE_LABELS[role.roleCode] || role.roleCode }}
                    <template v-if="role.storeName">· {{ role.storeName }}</template>
                  </span>
                </div>
              </td>
              <td class="whitespace-nowrap text-ink-500">{{ formatDate(user.createdAt, false) }}</td>
              <td class="whitespace-nowrap text-ink-500">
                {{ user.lastLoginAt ? formatDate(user.lastLoginAt, false) : "—" }}
              </td>
              <td><StatusBadge :map="USER_STATUS" :value="user.status" /></td>
              <td>
                <div class="flex justify-end gap-1">
                  <button
                    v-if="!isAdmin(user)"
                    type="button"
                    class="btn-ghost text-xs"
                    @click="toggleAdmin(user, false)"
                  >
                    Yönetici yap
                  </button>
                  <button
                    v-else-if="user.id !== auth.user?.id"
                    type="button"
                    class="btn-ghost text-xs"
                    @click="toggleAdmin(user, true)"
                  >
                    Yöneticiliği al
                  </button>

                  <button
                    v-if="user.status === 'active' && user.id !== auth.user?.id"
                    type="button"
                    class="btn-ghost text-xs text-red-600"
                    @click="pending = { user, status: 'suspended' }"
                  >
                    Askıya al
                  </button>
                  <button
                    v-else-if="user.status === 'suspended'"
                    type="button"
                    class="btn-ghost text-xs text-emerald-700"
                    @click="pending = { user, status: 'active' }"
                  >
                    Aktifleştir
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
        unit="kullanıcı"
        @change="(next) => (filters.page = next)"
      />
    </template>

    <ConfirmDialog
      :open="Boolean(pending)"
      :busy="busy"
      :title="pending?.status === 'suspended' ? 'Hesap askıya alınsın mı?' : 'Hesap aktifleştirilsin mi?'"
      :message="pending?.status === 'suspended'
        ? `${pending?.user.fullName} giriş yapamayacak ve tüm oturumları kapatılacak.`
        : `${pending?.user.fullName} yeniden giriş yapabilecek.`"
      :tone="pending?.status === 'suspended' ? 'danger' : 'primary'"
      confirm-label="Onayla"
      @confirm="applyStatus"
      @cancel="pending = null"
    />
  </div>
</template>
