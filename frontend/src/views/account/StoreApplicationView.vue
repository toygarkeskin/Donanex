<script setup>
import { reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const auth = useAuthStore();
const form = reactive({ name: "", description: "", contactEmail: "", phone: "", taxNumber: "" });
const submitted = ref(null);
const error = ref("");
const submitting = ref(false);

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    const result = await api.post("/me/store-application", { ...form });
    submitted.value = result;
    await auth.loadUser();
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Mağaza aç"
      description="Pazar'da satış yapmak için başvurun. Yönetici onayından sonra ürün ekleyebilirsiniz."
    />

    <AlertBox v-if="auth.hasStorePanel" tone="success" class="mb-6" title="Mağazanız var">
      <RouterLink :to="{ name: 'store-panel' }" class="font-semibold underline">Mağaza paneline gidin.</RouterLink>
    </AlertBox>

    <AlertBox v-if="submitted" tone="success" title="Başvurunuz alındı">
      {{ submitted.message }}
    </AlertBox>

    <AlertBox v-if="error" tone="error" class="mb-6">{{ error }}</AlertBox>

    <form v-if="!submitted" class="card space-y-4 p-5" @submit.prevent="submit">
      <FormField id="name" label="Mağaza adı" required hint="Müşterilerin göreceği ad.">
        <input id="name" v-model="form.name" type="text" class="field" required maxlength="120" />
      </FormField>

      <FormField id="description" label="Mağaza açıklaması" required hint="Ne sattığınızı kısaca anlatın.">
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

      <FormField id="taxNumber" label="Vergi numarası">
        <input id="taxNumber" v-model="form.taxNumber" type="text" class="field" maxlength="30" />
      </FormField>

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? "Gönderiliyor…" : "Başvuruyu gönder" }}
      </button>
    </form>
  </div>
</template>
