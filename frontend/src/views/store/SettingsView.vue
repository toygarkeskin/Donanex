<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import { useMagaza } from "../../lib/magaza";
import { STORE_STATUS } from "../../lib/format";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const { id: storeId, params: magazaParams } = useMagaza();
const auth = useAuthStore();
const toast = useToastStore();

const store = ref(null);
const loading = ref(true);
const saving = ref(false);
const form = reactive({ name: "", description: "", contactEmail: "", phone: "" });

async function load() {
  loading.value = true;
  try {
    store.value = await api.get(`/stores/${storeId.value}`);
    Object.assign(form, {
      name: store.value.name,
      description: store.value.description,
      contactEmail: store.value.contactEmail,
      phone: store.value.phone
    });
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const result = await api.put(`/stores/${storeId.value}`, { ...form });
    toast.success(result.message);
    await auth.loadUser();
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-2xl">
    <PageHeader title="Mağaza ayarları" description="Müşterilerin gördüğü bilgiler." />

    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="store">
      <div class="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p class="text-sm text-ink-500">Mağaza durumu</p>
          <StatusBadge :map="STORE_STATUS" :value="store.status" class="mt-1" />
        </div>
        <p class="text-sm text-ink-500">
          Adres: <code class="rounded bg-ink-100 px-2 py-0.5 text-xs">/magazalar/{{ store.slug }}</code>
        </p>
      </div>

      <AlertBox v-if="store.status === 'pending'" tone="warn" class="mb-6" title="Onay bekleniyor">
        Mağazanız yönetici onayından sonra vitrinde görünecek ve sipariş alabileceksiniz.
      </AlertBox>
      <AlertBox v-else-if="store.status === 'suspended'" tone="error" class="mb-6" title="Mağazanız askıya alınmış">
        Ürünleriniz vitrinde görünmüyor. Ayrıntı için destek ekibiyle iletişime geçin.
      </AlertBox>

      <form class="card space-y-4 p-5" @submit.prevent="save">
        <FormField id="name" label="Mağaza adı" required>
          <input id="name" v-model="form.name" type="text" class="field" required maxlength="120" />
        </FormField>

        <FormField id="description" label="Açıklama" required>
          <textarea id="description" v-model="form.description" rows="4" class="field" required maxlength="2000" />
        </FormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField id="contactEmail" label="İletişim e-postası" required>
            <input id="contactEmail" v-model="form.contactEmail" type="email" class="field" required maxlength="254" />
          </FormField>
          <FormField id="phone" label="Telefon" required>
            <input id="phone" v-model="form.phone" type="tel" class="field" required maxlength="30" />
          </FormField>
        </div>

        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? "Kaydediliyor…" : "Değişiklikleri kaydet" }}
        </button>
      </form>
    </template>
  </div>
</template>
