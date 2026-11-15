<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";
import AppIcon from "./AppIcon.vue";

/*
 * Ürün soru-cevap.
 *
 * Soruyu giriş yapmış herkes sorabiliyor; yanıtı SATICI veriyor (ürünün
 * mağazasında yetkisi olan) ya da yönetim. Satıcı yanıtını ayrı bir panel
 * sayfasına gitmeden, doğrudan bu bölümde, sorunun altında yazıyor —
 * bildirimi de buraya getiriyor (#sorular).
 */
const props = defineProps({
  urun: { type: Object, required: true }
});

const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();

const sayfa = ref({ items: [], total: 0, page: 1, pages: 1 });
const yukleniyor = ref(true);
const soruMetni = ref("");
const soruluyor = ref(false);
const yanitlar = reactive({});
const yanitlaniyor = ref(null);
const bolum = ref(null);

/* Yanıt yazabilen: o mağazanın üyesi ya da sistem yöneticisi. Sunucu ayrıca soruyor. */
const satici = computed(() => auth.isSystemAdmin || auth.stores.some((m) => m.id === props.urun.storeId));

async function yukle(sayfaNo = 1) {
  yukleniyor.value = true;
  try {
    const yeni = await api.get(`/urunler/${props.urun.id}/sorular?page=${sayfaNo}&pageSize=5`);
    sayfa.value = sayfaNo === 1 ? yeni : { ...yeni, items: [...sayfa.value.items, ...yeni.items] };
  } finally {
    yukleniyor.value = false;
  }
}

watch(
  () => props.urun.id,
  async () => {
    await yukle(1);
    /*
     * Bildirimden gelen bağlantı "#sorular" taşıyor. Yönlendirici sayfa
     * açılırken kaydırmayı deniyor ama o anda bölüm henüz yüklenmemiş oluyor;
     * sorular geldikten sonra burada kaydırılıyor.
     */
    if (route.hash === "#sorular") {
      await nextTick();
      bolum.value?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },
  { immediate: true }
);

async function sor() {
  soruluyor.value = true;
  try {
    const soru = await api.post(`/urunler/${props.urun.id}/sorular`, { body: soruMetni.value });
    sayfa.value = { ...sayfa.value, items: [soru, ...sayfa.value.items], total: sayfa.value.total + 1 };
    soruMetni.value = "";
    toast.success("Sorunuz satıcıya iletildi. Yanıtlandığında size haber vereceğiz.");
  } catch (hata) {
    toast.error(hata.message);
  } finally {
    soruluyor.value = false;
  }
}

async function yanitla(soru) {
  const metin = (yanitlar[soru.id] ?? "").trim();
  if (!metin) return;
  yanitlaniyor.value = soru.id;
  try {
    const yanit = await api.post(`/urunler/${props.urun.id}/sorular/${soru.id}/yanit`, { body: metin });
    soru.answers = [...(soru.answers ?? []), yanit];
    yanitlar[soru.id] = "";
    toast.success("Yanıtınız yayınlandı; soru sahibine bildirim gitti.");
  } catch (hata) {
    toast.error(hata.message);
  } finally {
    yanitlaniyor.value = null;
  }
}

const girisYap = () => auth.login(route.fullPath + "#sorular");
</script>

<template>
  <section id="sorular" ref="bolum" class="scroll-mt-24">
    <h2 class="mb-4 text-lg font-bold text-ink-900">
      Soru &amp; cevap
      <span v-if="sayfa.total" class="text-sm font-normal text-ink-500">({{ sayfa.total }})</span>
    </h2>

    <form v-if="auth.isSignedIn && !satici" class="card mb-4 flex flex-col gap-2 p-4 sm:flex-row" @submit.prevent="sor">
      <label for="soru-metni" class="sr-only">Satıcıya sorunuz</label>
      <input
        id="soru-metni"
        v-model="soruMetni"
        type="text"
        class="field"
        minlength="5"
        maxlength="1000"
        required
        placeholder="Bu ürün hakkında satıcıya bir soru sorun…"
      />
      <button type="submit" class="btn-primary shrink-0" :disabled="soruluyor">
        {{ soruluyor ? "Gönderiliyor…" : "Soru sor" }}
      </button>
    </form>
    <p v-else-if="!auth.isSignedIn" class="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-ink-600">
      Satıcıya soru sormak için giriş yapın.
      <button type="button" class="btn-secondary" @click="girisYap">Giriş yap</button>
    </p>

    <p v-if="!yukleniyor && !sayfa.items.length" class="card p-6 text-center text-sm text-ink-500">
      Bu ürün hakkında henüz soru sorulmadı.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="soru in sayfa.items" :key="soru.id" class="card p-4">
        <div class="flex gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">S</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink-800">{{ soru.body }}</p>
            <p class="mt-0.5 text-xs text-ink-400">{{ soru.authorName }} · {{ formatDate(soru.createdAt, false) }}</p>
          </div>
        </div>

        <div v-for="yanit in soru.answers" :key="yanit.id" class="mt-3 flex gap-3 border-t border-ink-100 pt-3 pl-2">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <AppIcon name="magaza" :size="14" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="whitespace-pre-line text-sm text-ink-700">{{ yanit.body }}</p>
            <p class="mt-0.5 text-xs text-ink-400">
              <span class="font-semibold text-brand-600">{{ yanit.authorName }}</span> · {{ formatDate(yanit.createdAt, false) }}
            </p>
          </div>
        </div>

        <p v-if="!soru.answers?.length && !satici" class="mt-2 pl-10 text-xs text-ink-400">Satıcının yanıtı bekleniyor.</p>

        <!-- Satıcıya: sorunun altında doğrudan yanıt alanı. -->
        <form v-if="satici" class="mt-3 flex flex-col gap-2 border-t border-ink-100 pt-3 sm:flex-row" @submit.prevent="yanitla(soru)">
          <label :for="`yanit-${soru.id}`" class="sr-only">Yanıtınız</label>
          <input
            :id="`yanit-${soru.id}`"
            v-model="yanitlar[soru.id]"
            type="text"
            class="field"
            maxlength="1000"
            :placeholder="soru.answers?.length ? 'Ek yanıt yazın…' : 'Yanıtınızı yazın…'"
          />
          <button type="submit" class="btn-primary shrink-0" :disabled="yanitlaniyor === soru.id || !(yanitlar[soru.id] ?? '').trim()">
            {{ yanitlaniyor === soru.id ? "Gönderiliyor…" : "Yanıtla" }}
          </button>
        </form>
      </li>
    </ul>

    <button
      v-if="sayfa.page < sayfa.pages"
      type="button"
      class="btn-secondary mt-3 w-full"
      :disabled="yukleniyor"
      @click="yukle(sayfa.page + 1)"
    >
      Daha fazla soru ({{ sayfa.total - sayfa.items.length }})
    </button>
  </section>
</template>
