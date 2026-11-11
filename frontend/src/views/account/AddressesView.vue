<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../../lib/api";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import EmptyState from "../../components/EmptyState.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";

const toast = useToastStore();

const addresses = ref([]);
const loading = ref(true);
const editing = ref(null);
const saving = ref(false);
const removing = ref(null);

const blank = () => ({ title: "", fullName: "", phone: "", city: "", district: "", line: "", postalCode: "" });
const form = reactive(blank());

async function load() {
  loading.value = true;
  try {
    addresses.value = (await api.get("/me/addresses")).items;
  } finally {
    loading.value = false;
  }
}

function openNew() {
  Object.assign(form, blank());
  editing.value = "new";
}

function openEdit(address) {
  Object.assign(form, { ...address, postalCode: address.postalCode || "" });
  editing.value = address.id;
}

async function save() {
  saving.value = true;
  try {
    const payload = { ...form, postalCode: form.postalCode || null };
    if (editing.value === "new") await api.post("/me/addresses", payload);
    else await api.put(`/me/addresses/${editing.value}`, payload);

    toast.success("Adresiniz kaydedildi.");
    editing.value = null;
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  try {
    await api.delete(`/me/addresses/${removing.value}`);
    toast.success("Adres silindi.");
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
  <div>
    <PageHeader title="Adreslerim" description="Kayıtlı adresleriniz ödeme adımında hazır gelir.">
      <template #actions>
        <button type="button" class="btn-primary" @click="openNew">+ Yeni adres</button>
      </template>
    </PageHeader>

    <LoadingBlock v-if="loading" :rows="2" />

    <EmptyState
      v-else-if="!addresses.length && !editing"
      title="Kayıtlı adresiniz yok"
      description="Adres eklerseniz her siparişte yeniden yazmanız gerekmez."
      icon="konum"
    >
      <button type="button" class="btn-primary" @click="openNew">Adres ekle</button>
    </EmptyState>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <article v-for="address in addresses" :key="address.id" class="card p-4">
        <div class="flex items-start justify-between gap-2">
          <p class="font-semibold text-ink-900">{{ address.title }}</p>
          <div class="flex gap-1">
            <button type="button" class="btn-ghost text-xs" @click="openEdit(address)">Düzenle</button>
            <button type="button" class="btn-ghost text-xs text-red-600" @click="removing = address.id">Sil</button>
          </div>
        </div>
        <address class="mt-2 not-italic text-sm leading-relaxed text-ink-600">
          <p class="font-medium text-ink-800">{{ address.fullName }}</p>
          <p>{{ address.line }}</p>
          <p>{{ address.district }} / {{ address.city }}</p>
          <p class="mt-1">{{ address.phone }}</p>
        </address>
      </article>
    </div>

    <form v-if="editing" class="card mt-6 p-5" @submit.prevent="save">
      <h2 class="text-base font-semibold text-ink-900">
        {{ editing === "new" ? "Yeni adres" : "Adresi düzenle" }}
      </h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField id="title" label="Adres başlığı" hint="Örnek: Ev, İş">
          <input id="title" v-model="form.title" type="text" class="field" maxlength="60" />
        </FormField>
        <FormField id="addressName" label="Ad Soyad" required>
          <input id="addressName" v-model="form.fullName" type="text" class="field" required maxlength="150" />
        </FormField>
        <FormField id="addressPhone" label="Telefon" required>
          <input id="addressPhone" v-model="form.phone" type="tel" class="field" required maxlength="30" />
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
      </div>

      <div class="mt-5 flex gap-2">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? "Kaydediliyor…" : "Kaydet" }}
        </button>
        <button type="button" class="btn-secondary" @click="editing = null">Vazgeç</button>
      </div>
    </form>

    <ConfirmDialog
      :open="Boolean(removing)"
      title="Adres silinsin mi?"
      confirm-label="Sil"
      @confirm="remove"
      @cancel="removing = null"
    />
  </div>
</template>
