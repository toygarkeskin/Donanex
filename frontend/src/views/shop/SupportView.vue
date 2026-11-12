<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import PageHeader from "../../components/PageHeader.vue";
import FormField from "../../components/FormField.vue";
import AlertBox from "../../components/AlertBox.vue";
import AppIcon from "../../components/AppIcon.vue";

const auth = useAuthStore();
const form = reactive({ email: "", fullName: "", subject: "", message: "" });
const sent = ref(null);
const error = ref("");
const submitting = ref(false);

/*
 * Ekler — YALNIZCA GİRİŞ YAPMIŞ kullanıcıya.
 *
 * Ek, talep açıldıktan SONRA ayrı bir istekle yükleniyor ve o uç talebin
 * sahibini soruyor. Misafirin talebi bir hesaba bağlı değil, yani sonradan
 * "bu talep senin" diyebileceğimiz bir kimlik yok; misafire ek açmak, her
 * talep numarasını bilen herkese dosya yükleme kapısı açmak olurdu.
 */
const EN_FAZLA_BAYT = 5 * 1024 * 1024;
const EN_FAZLA_EK = 5;
const TURLER = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const dosyalar = ref([]);
const dosyaHatasi = ref("");
const secici = ref(null);

const boyut = (bayt) =>
  bayt >= 1024 * 1024 ? `${(bayt / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bayt / 1024))} KB`;

function sec(olay) {
  dosyaHatasi.value = "";
  const secilen = [...(olay.target.files ?? [])];
  olay.target.value = "";

  for (const dosya of secilen) {
    if (dosyalar.value.length >= EN_FAZLA_EK) {
      dosyaHatasi.value = `En fazla ${EN_FAZLA_EK} dosya eklenebilir.`;
      break;
    }
    if (!TURLER.includes(dosya.type)) {
      dosyaHatasi.value = `${dosya.name}: yalnızca PNG, JPEG, WebP ve PDF eklenebilir.`;
      continue;
    }
    if (dosya.size > EN_FAZLA_BAYT) {
      dosyaHatasi.value = `${dosya.name}: en fazla 5 MB olabilir (${boyut(dosya.size)}).`;
      continue;
    }
    dosyalar.value.push(dosya);
  }
}

const cikar = (i) => dosyalar.value.splice(i, 1);

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    const talep = await api.post("/support/tickets", { ...form });

    /*
     * Ekler talepten SONRA yükleniyor. Biri başarısız olursa talep yine
     * açılmış durumda — o yüzden hata talebi geri almıyor, yalnızca hangi
     * dosyanın yüklenemediğini söylüyor. Kullanıcı eksik olanı talep
     * ayrıntısından yeniden ekleyebilir.
     */
    const yuklenemeyen = [];
    for (const dosya of dosyalar.value) {
      try {
        await api.uploadNamed(`/me/tickets/${talep.id}/ekler`, dosya);
      } catch (yuklemeHatasi) {
        yuklenemeyen.push(`${dosya.name} (${yuklemeHatasi.message})`);
      }
    }

    sent.value = { ...talep, ekSayisi: dosyalar.value.length - yuklenemeyen.length, yuklenemeyen };
    Object.assign(form, { subject: "", message: "" });
    dosyalar.value = [];
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
      Talep numaranız <strong>{{ sent.reference }}</strong>.
      <template v-if="sent.ekSayisi">{{ sent.ekSayisi }} dosya eklendi.</template>
      Yanıt e-posta adresinize gönderilecek.
      <RouterLink v-if="auth.isSignedIn" :to="{ name: 'account-tickets' }" class="font-semibold underline">
        Taleplerimden takip edin.
      </RouterLink>
    </AlertBox>

    <AlertBox v-if="sent?.yuklenemeyen?.length" tone="warn" title="Bazı dosyalar eklenemedi" class="mb-6">
      {{ sent.yuklenemeyen.join(", ") }}. Talebiniz açıldı; eksik dosyayı Taleplerim sayfasından ekleyebilirsiniz.
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

      <div v-if="auth.isSignedIn">
        <p class="field-label">Ekler <span class="font-normal text-ink-500">(isteğe bağlı)</span></p>

        <ul v-if="dosyalar.length" class="mb-2 space-y-2">
          <li
            v-for="(dosya, i) in dosyalar"
            :key="dosya.name + i"
            class="flex items-center gap-3 rounded-lg border border-ink-200 p-2.5"
          >
            <AppIcon :name="dosya.type === 'application/pdf' ? 'belge' : 'gorsel'" :size="18" class="text-ink-400" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-ink-800">{{ dosya.name }}</span>
              <span class="block text-xs text-ink-500">{{ boyut(dosya.size) }}</span>
            </span>
            <button
              type="button"
              class="rounded-md p-1 text-ink-500 hover:bg-ink-100"
              :aria-label="`${dosya.name} dosyasını çıkar`"
              @click="cikar(i)"
            >
              <AppIcon name="kapat" :size="16" />
            </button>
          </li>
        </ul>

        <input
          ref="secici"
          type="file"
          class="sr-only"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          @change="sec"
        />
        <button
          type="button"
          class="btn-secondary"
          :disabled="dosyalar.length >= EN_FAZLA_EK"
          @click="secici?.click()"
        >
          <AppIcon name="ek" :size="16" /> Dosya ekle
        </button>
        <p class="mt-1.5 text-xs text-ink-500">
          Ekran görüntüsü, fatura ya da belge · PNG, JPEG, WebP, PDF · dosya başına en fazla 5 MB · en fazla
          {{ EN_FAZLA_EK }} dosya
        </p>
        <p v-if="dosyaHatasi" class="field-error">{{ dosyaHatasi }}</p>
      </div>

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? "Gönderiliyor…" : "Talebi gönder" }}
      </button>
      <p class="text-xs text-ink-500">
        Üye olmadan da destek talebi açabilirsiniz.
        <template v-if="!auth.isSignedIn">Dosya eklemek için giriş yapmanız gerekir.</template>
      </p>
    </form>
  </div>
</template>
