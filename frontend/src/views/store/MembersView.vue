<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import { useMagaza } from "../../lib/magaza";
import { formatDate, ROLE_LABELS } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";

const route = useRoute();
const { id: storeId, params: magazaParams } = useMagaza();
const toast = useToastStore();

const members = ref([]);
const loading = ref(true);
const form = reactive({ email: "", roleCode: "STORE_STAFF" });
const adding = ref(false);
const removing = ref(null);

async function load() {
  loading.value = true;
  try {
    members.value = (await api.get(`/stores/${storeId.value}/members`)).items;
  } finally {
    loading.value = false;
  }
}

async function add() {
  adding.value = true;
  try {
    const result = await api.post(`/stores/${storeId.value}/members`, { ...form });
    toast.success(result.message);
    form.email = "";
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    adding.value = false;
  }
}

async function remove() {
  try {
    const result = await api.post(`/stores/${storeId.value}/members`, {
      userId: removing.value.id,
      roleCode: removing.value.roleCode,
      remove: true
    });
    toast.success(result.message);
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    removing.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-4xl">
    <PageHeader
      title="Çalışanlar"
      description="Mağazanızda ürün ve sipariş yönetebilecek kişiler."
    />

    <AlertBox tone="info" class="mb-6">
      Çalışan eklemek için kişinin Donanex'da hesabı olmalı. Verdiğiniz yetki <strong>yalnızca bu
      mağazada</strong> geçerlidir; başka mağazaların verisine erişemez.
    </AlertBox>

    <form class="card mb-6 flex flex-wrap items-end gap-3 p-5" @submit.prevent="add">
      <div class="min-w-60 flex-1">
        <FormField id="email" label="Kullanıcının e-postası" required>
          <input id="email" v-model="form.email" type="email" class="field" required maxlength="254" />
        </FormField>
      </div>
      <div class="min-w-44">
        <FormField id="roleCode" label="Rol">
          <select id="roleCode" v-model="form.roleCode" class="field">
            <option value="STORE_STAFF">Mağaza Çalışanı</option>
            <option value="STORE_OWNER">Mağaza Sahibi</option>
          </select>
        </FormField>
      </div>
      <button type="submit" class="btn-primary" :disabled="adding">
        {{ adding ? "Ekleniyor…" : "Ekle" }}
      </button>
    </form>

    <LoadingBlock v-if="loading" :rows="2" />

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Kişi</th>
            <th>Rol</th>
            <th>Eklenme</th>
            <th class="text-right">İşlem</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in members" :key="`${member.id}-${member.roleCode}`">
            <td>
              <p class="font-medium text-ink-800">{{ member.fullName }}</p>
              <p class="text-xs text-ink-500">{{ member.email }}</p>
            </td>
            <td>
              {{ ROLE_LABELS[member.roleCode] || member.roleCode }}
              <span v-if="member.isOwner" class="ml-1 text-xs text-ink-400">(kurucu)</span>
            </td>
            <td class="text-ink-500">{{ formatDate(member.grantedAt, false) }}</td>
            <td class="text-right">
              <button
                v-if="!member.isOwner"
                type="button"
                class="btn-ghost text-xs text-red-600"
                @click="removing = member"
              >
                Çıkar
              </button>
              <span v-else class="text-xs text-ink-400">Çıkarılamaz</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmDialog
      :open="Boolean(removing)"
      title="Çalışan çıkarılsın mı?"
      :message="`${removing?.fullName} bu mağazadaki yetkisini kaybedecek.`"
      confirm-label="Çıkar"
      @confirm="remove"
      @cancel="removing = null"
    />
  </div>
</template>
