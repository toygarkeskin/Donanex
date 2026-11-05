<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const auth = useAuthStore();
const form = reactive({ email: "", fullName: "", subject: "", message: "" });
const sent = ref(null);
const error = ref("");
const submitting = ref(false);

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    sent.value = await api.post("/support/tickets", { ...form });
    Object.assign(form, { subject: "", message: "" });
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (auth.isSignedIn) {
    form.email = auth.user.email;
    form.fullName = auth.user.fullName;
  }
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader title="Destek" description="Sorununuzu yazın, ekibimiz e-posta ile dönüş yapsın." />

    <AlertBox v-if="sent" tone="success" title="Talebiniz alındı" class="mb-6">
      Talep numaranız <strong>{{ sent.reference }}</strong>. Yanıt e-posta adresinize gönderilecek.
      <RouterLink v-if="auth.isSignedIn" :to="{ name: 'account-tickets' }" class="font-semibold underline">
        Taleplerimden takip edin.
      </RouterLink>
    </AlertBox>

    <AlertBox v-if="error" tone="error" class="mb-6">{{ error }}</AlertBox>

    <form class="card space-y-4 p-5" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField id="fullName" label="Ad Soyad" required>
          <input id="fullName" v-model="form.fullName" type="text" class="field" required maxlength="150" />
        </FormField>
        <FormField id="email" label="E-posta" required>
          <input id="email" v-model="form.email" type="email" class="field" required maxlength="254" />
        </FormField>
      </div>

      <FormField id="subject" label="Konu" required>
        <input id="subject" v-model="form.subject" type="text" class="field" required maxlength="200" />
      </FormField>

      <FormField id="message" label="Mesajınız" required>
        <textarea id="message" v-model="form.message" rows="6" class="field" required maxlength="5000" />
      </FormField>

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? "Gönderiliyor…" : "Talebi gönder" }}
      </button>
      <p class="text-xs text-ink-500">Üye olmadan da destek talebi açabilirsiniz.</p>
    </form>
  </div>
</template>
