<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import AppIcon from "./AppIcon.vue";

/*
 * Panel gösterge kartı.
 *
 * Kart artık TIKLANABİLİR olabiliyor ("to" verilirse): "4 onay bekleyen
 * mağaza" yazan bir kutuya basmak, o listeye gitmenin en doğal yolu.
 * Önceden sayıyı görüp menüden ilgili sayfayı aramak gerekiyordu.
 *
 * Eğilim (trend) uydurulmuyor: yalnızca çağıran gerçekten hesapladığında
 * gösteriliyor. Gösterge panellerinde yüzdeyi her kutuya koymak yaygın bir
 * alışkanlık ama karşılığı olmayan bir sayı, olmayan bir sayıdan kötüdür.
 */
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: "—" },
  hint: { type: String, default: "" },
  tone: { type: String, default: "neutral" },
  icon: { type: String, default: "" },
  /** Yüzde değişim; null ise hiç çizilmez. */
  trend: { type: Number, default: null },
  /** Eğilimin neye göre olduğu ("önceki 7 güne göre"). */
  trendHint: { type: String, default: "" },
  /** Verilirse kart bağlantıya dönüşür. */
  to: { type: [Object, String], default: null }
});

const tones = {
  neutral: "text-ink-900",
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700"
};

/** Simgenin arka plan rengi: kutunun tonunu tekrar eder, bağırmadan. */
const simgeTonlari = {
  neutral: "bg-ink-100 text-ink-500",
  good: "bg-emerald-50 text-emerald-600",
  warn: "bg-amber-50 text-amber-600",
  bad: "bg-red-50 text-red-600"
};

const yukseliyor = computed(() => (props.trend ?? 0) >= 0);

/** "+%12" / "-%8"; sıfır değişimde işaret yok. */
const trendMetni = computed(() => {
  if (props.trend === null) return "";
  if (props.trend === 0) return "%0";
  return `${yukseliyor.value ? "+" : "−"}%${Math.abs(Math.round(props.trend))}`;
});
</script>

<template>
  <component
    :is="to ? RouterLink : 'article'"
    :to="to || undefined"
    class="card min-w-0 p-3 transition sm:p-4"
    :class="to ? 'block hover:border-brand-200 hover:shadow-sm' : ''"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-medium uppercase tracking-wide text-ink-500 sm:text-xs">{{ label }}</p>
        <!--
          Telefonda kutular ikişerli diziliyor, yani genişlik yarıya iniyor.
          Sayı orada text-2xl kalsaydı uzun tutarlar ("₺268.399,00") kutuyu
          esnetiyordu; bu yüzden telefonda bir ölçü küçük ve break-words açık.
        -->
        <p class="mt-1.5 break-words text-xl font-bold sm:mt-2 sm:text-2xl" :class="tones[tone] || tones.neutral">
          {{ value }}
        </p>
      </div>

      <!-- Simge telefonda GİZLİ: 160px genişliğindeki kutuda sayının yerini
           yiyordu ve etiket zaten aynı şeyi söylüyor. -->
      <span
        v-if="icon"
        class="hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex"
        :class="simgeTonlari[tone] || simgeTonlari.neutral"
        aria-hidden="true"
      >
        <AppIcon :name="icon" :size="18" />
      </span>
    </div>

    <div v-if="trendMetni || hint" class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span
        v-if="trendMetni"
        class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
        :class="yukseliyor ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
      >
        {{ trendMetni }}
      </span>
      <span v-if="trendHint" class="text-[11px] text-ink-400">{{ trendHint }}</span>
      <span v-if="hint" class="text-xs text-ink-500">{{ hint }}</span>
    </div>
  </component>
</template>
