<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";
import AppIcon from "./AppIcon.vue";
import YildizPuan from "./YildizPuan.vue";

/*
 * Ürün yorumları: puan özeti, liste ve yorum formu.
 *
 * Yorum fotoğrafları yorum YAZILDIKTAN sonra yükleniyor (sunucu yalnızca
 * yorumun sahibine izin veriyor). Kullanıcı açısından tek adım: formda
 * fotoğrafları seçip "Gönder"e basıyor; önce yorum, sonra fotoğraflar sırayla
 * gidiyor. Bir fotoğraf yüklenemezse yorum yine kaydedilmiş oluyor ve hangi
 * dosyanın olmadığı söyleniyor.
 */
const props = defineProps({
  urun: { type: Object, required: true }
});
const emit = defineEmits(["ozet"]);

const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();

const sayfa = ref({ items: [], total: 0, page: 1, pages: 1, summary: null });
const yukleniyor = ref(true);

const formAcik = ref(false);
const puan = ref(0);
const metin = ref("");
const fotograflar = ref([]);
const gonderiliyor = ref(false);
const fotoSecici = ref(null);

const EN_FAZLA_FOTO = 3;
const EN_FAZLA_BAYT = 2 * 1024 * 1024;
const TURLER = ["image/png", "image/jpeg", "image/webp"];

/* Mağaza kendi ürününe yorum yazamıyor (sunucu da reddediyor); form hiç çıkmasın. */
const kendiMagazasi = computed(() => auth.stores.some((m) => m.id === props.urun.storeId));
const ozet = computed(() => sayfa.value.summary);

async function yukle(sayfaNo = 1) {
  yukleniyor.value = true;
  try {
    const yeni = await api.get(`/urunler/${props.urun.id}/yorumlar?page=${sayfaNo}&pageSize=5`);
    // "Daha fazla" ile gelenler listenin SONUNA ekleniyor, liste baştan yüklenmiyor.
    sayfa.value = sayfaNo === 1 ? yeni : { ...yeni, items: [...sayfa.value.items, ...yeni.items] };
    emit("ozet", yeni.summary);
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => props.urun.id, () => yukle(1), { immediate: true });

function fotoSec(olay) {
  const secilen = [...(olay.target.files ?? [])];
  olay.target.value = "";
  for (const dosya of secilen) {
    if (fotograflar.value.length >= EN_FAZLA_FOTO) {
      toast.error(`En fazla ${EN_FAZLA_FOTO} fotoğraf eklenebilir.`);
      break;
    }
    if (!TURLER.includes(dosya.type)) {
      toast.error(`${dosya.name}: yalnızca PNG, JPEG ve WebP.`);
      continue;
    }
    if (dosya.size > EN_FAZLA_BAYT) {
      toast.error(`${dosya.name}: en fazla 2 MB olabilir.`);
      continue;
    }
    fotograflar.value.push({ dosya, onizleme: URL.createObjectURL(dosya) });
  }
}

function fotoCikar(i) {
  URL.revokeObjectURL(fotograflar.value[i].onizleme);
  fotograflar.value.splice(i, 1);
}

async function gonder() {
  if (!puan.value) {
    toast.error("Lütfen bir puan seçin.");
    return;
  }
  gonderiliyor.value = true;
  try {
    const yorum = await api.post(`/urunler/${props.urun.id}/yorumlar`, { rating: puan.value, body: metin.value });
    const olmayan = [];
    for (const { dosya } of fotograflar.value) {
      try {
        await api.upload(`/urunler/${props.urun.id}/yorumlar/${yorum.id}/fotograflar`, dosya);
      } catch (hata) {
        olmayan.push(`${dosya.name} (${hata.message})`);
      }
    }
    toast.success(yorum.created === false ? "Yorumunuz güncellendi." : "Yorumunuz yayınlandı. Teşekkürler!");
    if (olmayan.length) toast.error(`Bazı fotoğraflar eklenemedi: ${olmayan.join(", ")}`);

    fotograflar.value.forEach((f) => URL.revokeObjectURL(f.onizleme));
    formAcik.value = false;
    puan.value = 0;
    metin.value = "";
    fotograflar.value = [];
    await yukle(1);
  } catch (hata) {
    toast.error(hata.message);
  } finally {
    gonderiliyor.value = false;
  }
}

const yuzde = (adet) => (ozet.value?.count ? Math.round((adet / ozet.value.count) * 100) : 0);
const girisYap = () => auth.login(route.fullPath + "#yorumlar");
</script>

<template>
  <section id="yorumlar" class="scroll-mt-24">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-bold text-ink-900">Değerlendirmeler</h2>
      <button v-if="auth.isSignedIn && !kendiMagazasi && !formAcik" type="button" class="btn-secondary" @click="formAcik = true">
        Yorum yaz
      </button>
      <button v-else-if="!auth.isSignedIn" type="button" class="btn-secondary" @click="girisYap">
        Yorum yazmak için giriş yapın
      </button>
    </div>

    <!-- Puan özeti -->
    <div v-if="ozet?.count" class="card mb-4 grid gap-5 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5">
      <div class="text-center sm:pr-5">
        <p class="text-4xl font-bold text-ink-900">{{ ozet.average.toLocaleString("tr-TR") }}</p>
        <YildizPuan :puan="ozet.average" :boyut="18" />
        <p class="mt-1 text-xs text-ink-500">{{ ozet.count }} değerlendirme</p>
      </div>
      <ul class="space-y-1.5">
        <li v-for="(adet, i) in ozet.distribution" :key="i" class="flex items-center gap-2 text-xs text-ink-600">
          <span class="w-12 shrink-0">{{ 5 - i }} yıldız</span>
          <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
            <span class="block h-full rounded-full bg-amber-400" :style="{ width: `${yuzde(adet)}%` }" />
          </span>
          <span class="w-8 shrink-0 text-right">{{ adet }}</span>
        </li>
      </ul>
    </div>

    <!-- Yorum formu -->
    <form v-if="formAcik" class="card mb-4 space-y-3 p-4 sm:p-5" @submit.prevent="gonder">
      <div>
        <p class="field-label">Puanınız</p>
        <!-- Yıldızlar düğme: klavyeyle de seçilebiliyor, ekran okuyucu "3 yıldız" diyor. -->
        <div class="flex gap-1" role="radiogroup" aria-label="Puan">
          <button
            v-for="i in 5"
            :key="i"
            type="button"
            role="radio"
            :aria-checked="puan === i"
            :aria-label="`${i} yıldız`"
            class="rounded p-0.5 transition hover:scale-110"
            :class="i <= puan ? 'text-amber-400' : 'text-ink-300'"
            @click="puan = i"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8z" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label for="yorum-metni" class="field-label">Yorumunuz</label>
        <textarea
          id="yorum-metni"
          v-model="metin"
          rows="4"
          class="field"
          minlength="10"
          maxlength="2000"
          required
          placeholder="Ürünü nasıl buldunuz? Neyi beğendiniz, neyi beğenmediniz?"
        />
        <p class="mt-1 text-xs text-ink-500">En az 10 karakter. Adınız "Ayşe Y." biçiminde kısaltılarak görünür.</p>
      </div>

      <div>
        <p class="field-label">Fotoğraflar <span class="font-normal text-ink-500">(isteğe bağlı, en fazla 3)</span></p>
        <div class="flex flex-wrap gap-2">
          <div v-for="(foto, i) in fotograflar" :key="foto.onizleme" class="relative size-20 overflow-hidden rounded-lg border border-ink-200">
            <img :src="foto.onizleme" alt="" class="h-full w-full object-cover" />
            <button
              type="button"
              class="absolute right-1 top-1 rounded-full bg-night/70 p-0.5 text-white"
              :aria-label="`${foto.dosya.name} fotoğrafını çıkar`"
              @click="fotoCikar(i)"
            >
              <AppIcon name="kapat" :size="14" />
            </button>
          </div>
          <button
            v-if="fotograflar.length < EN_FAZLA_FOTO"
            type="button"
            class="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-300 text-xs text-ink-500 hover:border-brand-400 hover:text-brand-600"
            @click="fotoSecici?.click()"
          >
            <AppIcon name="gorsel" :size="20" />
            Ekle
          </button>
          <input ref="fotoSecici" type="file" class="sr-only" multiple accept="image/png,image/jpeg,image/webp" @change="fotoSec" />
        </div>
      </div>

      <div class="flex gap-2">
        <button type="submit" class="btn-primary" :disabled="gonderiliyor">
          {{ gonderiliyor ? "Gönderiliyor…" : "Yorumu gönder" }}
        </button>
        <button type="button" class="btn-ghost" @click="formAcik = false">Vazgeç</button>
      </div>
    </form>

    <p v-if="!yukleniyor && !sayfa.items.length" class="card p-6 text-center text-sm text-ink-500">
      Bu ürün için henüz yorum yok. İlk yorumu siz yazın.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="yorum in sayfa.items" :key="yorum.id" class="card p-4">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <YildizPuan :puan="yorum.rating" :boyut="15" />
          <span class="text-sm font-semibold text-ink-800">{{ yorum.authorName }}</span>
          <span
            v-if="yorum.verifiedPurchase"
            class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
          >
            <AppIcon name="onay" :size="12" /> Satın aldı
          </span>
          <span class="ml-auto text-xs text-ink-400">{{ formatDate(yorum.createdAt, false) }}</span>
        </div>
        <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{{ yorum.body }}</p>
        <div v-if="yorum.photos?.length" class="mt-3 flex flex-wrap gap-2">
          <a
            v-for="foto in yorum.photos"
            :key="foto.id"
            :href="foto.imageUrl"
            target="_blank"
            rel="noopener"
            class="block size-20 overflow-hidden rounded-lg border border-ink-200 hover:border-brand-300"
          >
            <img :src="foto.imageUrl" :alt="`${yorum.authorName} kullanıcısının fotoğrafı`" class="h-full w-full object-cover" loading="lazy" />
          </a>
        </div>
      </li>
    </ul>

    <button
      v-if="sayfa.page < sayfa.pages"
      type="button"
      class="btn-secondary mt-3 w-full"
      :disabled="yukleniyor"
      @click="yukle(sayfa.page + 1)"
    >
      Daha fazla yorum ({{ sayfa.total - sayfa.items.length }})
    </button>
  </section>
</template>
