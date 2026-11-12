<script setup>
import { computed, ref } from "vue";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useToastStore } from "../stores/toast";
import AppIcon from "./AppIcon.vue";

/*
 * Destek talebinin ekleri: liste, indirme ve yükleme.
 *
 * Aynı bileşen üç yerde — müşterinin talep ayrıntısı, mağaza paneli ve
 * yönetim paneli. Farkı yalnızca adresler; onları çağıran veriyor.
 *
 * Tür ve boyut BURADA DA denetleniyor ama bu yalnızca HIZ için: kullanıcı 20
 * MB'lık bir videoyu seçtiğinde, yükleme bitene kadar beklemeden "olmaz"
 * duysun. Asıl karar sunucuda veriliyor ve oradaki denetim dosyanın
 * baytlarına bakıyor — buradaki ise istemcinin bildirdiği türe.
 */
const props = defineProps({
  ekler: { type: Array, default: () => [] },
  /** POST adresi; verilmezse yükleme düğmesi çizilmez (ör. kapalı talep). */
  yuklemeYolu: { type: String, default: "" },
  /** Ek kimliğinden indirme adresini üretir. */
  indirmeYolu: { type: Function, required: true },
  /** "Siz" / "Destek ekibi" gibi etiketler için kimin baktığı. */
  bakan: { type: String, default: "musteri" }
});

const emit = defineEmits(["eklendi"]);
const toast = useToastStore();

// Sunucudaki sınırlarla aynı (domain/support/Attachment.ts).
const EN_FAZLA_BAYT = 5 * 1024 * 1024;
const EN_FAZLA_EK = 5;
const TURLER = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

const yukleniyor = ref(false);
const secici = ref(null);

const yerKaldi = computed(() => props.ekler.length < EN_FAZLA_EK);

const boyut = (bayt) =>
  bayt >= 1024 * 1024 ? `${(bayt / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bayt / 1024))} KB`;

const kimden = (ek) => {
  if (props.bakan === "musteri") return ek.isStaff ? "Destek ekibi" : "Siz";
  return ek.isStaff ? "Ekip" : "Müşteri";
};

async function sec(olay) {
  const dosya = olay.target.files?.[0];
  // Aynı dosya tekrar seçilebilsin diye seçici her seferinde sıfırlanıyor.
  olay.target.value = "";
  if (!dosya) return;

  if (!TURLER.includes(dosya.type)) {
    toast.error("Yalnızca PNG, JPEG, WebP görseller ve PDF eklenebilir.");
    return;
  }
  if (dosya.size > EN_FAZLA_BAYT) {
    toast.error(`Ek en fazla 5 MB olabilir; seçtiğiniz dosya ${boyut(dosya.size)}.`);
    return;
  }

  yukleniyor.value = true;
  try {
    const ek = await api.uploadNamed(props.yuklemeYolu, dosya);
    toast.success("Ek yüklendi.");
    emit("eklendi", ek);
  } catch (error) {
    toast.error(error.message);
  } finally {
    yukleniyor.value = false;
  }
}

async function indir(ek) {
  try {
    await api.download(props.indirmeYolu(ek.id), ek.originalName);
  } catch (error) {
    toast.error(error.message);
  }
}
</script>

<template>
  <div>
    <ul v-if="ekler.length" class="space-y-2">
      <li v-for="ek in ekler" :key="ek.id">
        <!--
          Satırın tamamı indirme düğmesi: küçük bir simgeyi telefonda parmakla
          yakalamak zor, satır ise kolay.
        -->
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg border border-ink-200 bg-surface p-2.5 text-left hover:border-brand-200 hover:bg-brand-50/40"
          @click="indir(ek)"
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
            <AppIcon :name="ek.contentType === 'application/pdf' ? 'belge' : 'gorsel'" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-800">{{ ek.originalName }}</span>
            <span class="block text-xs text-ink-500">
              {{ boyut(ek.size) }} · {{ kimden(ek) }} · {{ formatDate(ek.createdAt) }}
            </span>
          </span>
          <span class="shrink-0 text-xs font-medium text-brand-600">İndir</span>
        </button>
      </li>
    </ul>

    <div v-if="yuklemeYolu" class="mt-2">
      <input
        ref="secici"
        type="file"
        class="sr-only"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        :disabled="yukleniyor || !yerKaldi"
        @change="sec"
      />
      <button
        type="button"
        class="btn-secondary w-full"
        :disabled="yukleniyor || !yerKaldi"
        @click="secici?.click()"
      >
        <AppIcon name="ek" :size="16" />
        {{ yukleniyor ? "Yükleniyor…" : "Dosya ekle" }}
      </button>
      <p class="mt-1.5 text-xs text-ink-500">
        <template v-if="yerKaldi">PNG, JPEG, WebP ya da PDF · en fazla 5 MB · {{ EN_FAZLA_EK - ekler.length }} ek hakkı kaldı</template>
        <template v-else>Bu talebe en fazla {{ EN_FAZLA_EK }} ek eklenebilir.</template>
      </p>
    </div>
  </div>
</template>
