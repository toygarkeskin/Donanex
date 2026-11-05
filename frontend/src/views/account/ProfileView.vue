<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { useToastStore } from "../../stores/toast";
import { ROLE_LABELS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";

const auth = useAuthStore();
const toast = useToastStore();

const profile = reactive({ fullName: "", phone: "" });
const password = reactive({ currentPassword: "", newPassword: "", confirm: "" });
const savingProfile = ref(false);
const savingPassword = ref(false);
const passwordError = ref("");

onMounted(() => {
  profile.fullName = auth.user?.fullName || "";
  profile.phone = auth.user?.phone || "";
});

async function saveProfile() {
  savingProfile.value = true;
  try {
    const result = await api.put("/me/profile", { ...profile });
    await auth.loadUser();
    toast.success(result.message);
  } catch (error) {
    toast.error(error.message);
  } finally {
    savingProfile.value = false;
  }
}

async function changePassword() {
  passwordError.value = "";
  if (password.newPassword !== password.confirm) {
    passwordError.value = "Yeni parolalar birbiriyle aynı değil.";
    return;
  }
  savingPassword.value = true;
  try {
    const result = await api.put("/me/password", {
      currentPassword: password.currentPassword,
      newPassword: password.newPassword
    });
    Object.assign(password, { currentPassword: "", newPassword: "", confirm: "" });
    toast.success(result.message);
  } catch (error) {
    passwordError.value = error.message;
  } finally {
    savingPassword.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Hesap bilgilerim" />

    <section class="card p-5">
      <h2 class="text-base font-semibold text-ink-900">Kişisel bilgiler</h2>

      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-ink-500">E-posta</dt>
          <dd class="font-medium text-ink-800">
            {{ auth.user?.email }}
            <span v-if="auth.user?.emailVerified" class="ml-1 text-xs text-emerald-700">✓ doğrulandı</span>
            <span v-else class="ml-1 text-xs text-amber-700">doğrulanmadı</span>
          </dd>
        </div>
        <div>
          <dt class="text-ink-500">Rolleriniz</dt>
          <dd class="font-medium text-ink-800">
            {{ auth.roles.map((role) => ROLE_LABELS[role] || role).join(", ") }}
          </dd>
        </div>
      </dl>

      <form class="mt-5 grid gap-4 sm:grid-cols-2" @submit.prevent="saveProfile">
        <FormField id="fullName" label="Ad Soyad" required>
          <input id="fullName" v-model="profile.fullName" type="text" class="field" required maxlength="150" />
        </FormField>
        <FormField id="phone" label="Telefon">
          <input id="phone" v-model="profile.phone" type="tel" class="field" maxlength="30" />
        </FormField>
        <div class="sm:col-span-2">
          <button type="submit" class="btn-primary" :disabled="savingProfile">
            {{ savingProfile ? "Kaydediliyor…" : "Bilgilerimi kaydet" }}
          </button>
        </div>
      </form>
    </section>

    <section class="card p-5">
      <h2 class="text-base font-semibold text-ink-900">Parola değiştir</h2>
      <p class="mt-1 text-sm text-ink-500">
        Parolanızı değiştirdiğinizde diğer cihazlardaki oturumlarınız kapatılır.
      </p>

      <AlertBox v-if="passwordError" tone="error" class="mt-4">{{ passwordError }}</AlertBox>

      <form class="mt-5 grid gap-4 sm:grid-cols-3" @submit.prevent="changePassword">
        <FormField id="currentPassword" label="Mevcut parola" required>
          <input
            id="currentPassword"
            v-model="password.currentPassword"
            type="password"
            class="field"
            required
            autocomplete="current-password"
          />
        </FormField>
        <FormField id="newPassword" label="Yeni parola" required>
          <input
            id="newPassword"
            v-model="password.newPassword"
            type="password"
            class="field"
            required
            minlength="10"
            autocomplete="new-password"
          />
        </FormField>
        <FormField id="confirm" label="Yeni parola (tekrar)" required>
          <input
            id="confirm"
            v-model="password.confirm"
            type="password"
            class="field"
            required
            minlength="10"
            autocomplete="new-password"
          />
        </FormField>
        <div class="sm:col-span-3">
          <button type="submit" class="btn-primary" :disabled="savingPassword">
            {{ savingPassword ? "Değiştiriliyor…" : "Parolayı değiştir" }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
