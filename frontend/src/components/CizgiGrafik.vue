<script setup>
import { computed, ref, useId } from "vue";

/*
 * Günlük seri grafiği — elle çizilmiş SVG, grafik kütüphanesi yok.
 *
 * Neden kütüphane değil: tek bir grafik türü için Chart.js ~200 KB paket
 * ekler, kendi renk ve yazı tipi sistemini getirir ve koyu temada renkleri
 * ayrıca ayarlamak gerekir. Buradaki çizim tema belirteçlerinden besleniyor,
 * yani açık/koyu geçişinde kendiliğinden doğru.
 *
 * ÖLÇEKLENME: SVG'nin kendi görünüm kutusu sabit (600x200) ve genişliği
 * kaba göre esniyor. "preserveAspectRatio=none" yatayda esnetiyor, bu da
 * çizginin kalınlığını bozardı — "vector-effect: non-scaling-stroke" bunu
 * engelliyor, çizgi her genişlikte aynı kalınlıkta kalıyor.
 *
 * YAZI SVG'NİN İÇİNDE DEĞİL: esneme metni de bozardı. Eksen etiketleri
 * altta normal HTML olarak duruyor, bu yüzden her ölçekte düzgün okunuyor.
 */
const props = defineProps({
  /** [{ date, deger }] — en eskiden en yeniye. */
  seri: { type: Array, default: () => [] },
  /** Noktanın üzerine gelince gösterilecek metni üreten işlev. */
  bicim: { type: Function, default: (deger) => String(deger) },
  yukseklik: { type: String, default: "h-48" }
});

const GENISLIK = 600;
const BOY = 200;
const BOSLUK = 10;

/* Degrade tanımının kimliği benzersiz olmalı: aynı sayfada iki grafik varsa
   ikisi de "#degrade" deseydi ikincisi birincininkini kullanırdı. */
const degradeId = `grafik-degrade-${useId()}`;

const secili = ref(null);

/** En yüksek değer; hepsi sıfırsa 1 (sıfıra bölme olmasın). */
const tepe = computed(() => Math.max(1, ...props.seri.map((gun) => Number(gun.deger) || 0)));

const noktalar = computed(() => {
  const n = props.seri.length;
  if (!n) return [];
  // Tek nokta varsa payda sıfır olurdu; o durumda nokta ortaya konuyor.
  const adim = n > 1 ? GENISLIK / (n - 1) : 0;
  return props.seri.map((gun, i) => {
    const deger = Number(gun.deger) || 0;
    return {
      ...gun,
      deger,
      x: n > 1 ? i * adim : GENISLIK / 2,
      y: BOY - BOSLUK - (deger / tepe.value) * (BOY - BOSLUK * 2)
    };
  });
});

const cizgi = computed(() => noktalar.value.map((n, i) => `${i ? "L" : "M"}${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(" "));

/** Dolgu, çizginin altını kapatır: aynı yol + iki kenardan tabana iner. */
const alan = computed(() => {
  const n = noktalar.value;
  if (!n.length) return "";
  return `${cizgi.value} L${n[n.length - 1].x.toFixed(1)},${BOY} L${n[0].x.toFixed(1)},${BOY} Z`;
});

/** Yatay kılavuz çizgileri: dörde bölünmüş alan. */
const kilavuz = [0, 0.25, 0.5, 0.75, 1].map((oran) => BOSLUK + oran * (BOY - BOSLUK * 2));

const kisaTarih = (date) =>
  new Date(date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

/*
 * Eksende kaç etiket gösterileceği.
 *
 * On dört etiketin hepsi dar ekranda üst üste biniyor. İki kademe var:
 * masaüstünde ikisinde biri, telefonda dörtte biri. İlk ve son gün HER İKİ
 * kademede de görünüyor — aralığın nerede başlayıp bittiği grafiğin en temel
 * bilgisi.
 *
 * Kademe CSS ile ayrılıyor (hidden sm:inline), JavaScript'le ekran ölçerek
 * değil: ölçerek yapılsaydı pencere yeniden boyutlandığında yeniden hesap
 * gerekir ve ilk çizimde yanlış kademe görünürdü.
 */
const sonIndeks = computed(() => props.seri.length - 1);
const ucNokta = (i) => i === 0 || i === sonIndeks.value;

/*
 * Telefon kademesi: dörtte bir + iki uç.
 *
 * "son - i >= 3" koşulu, SON etiketin komşusunu eliyor. Onsuz on dört
 * günlük seride hem 12. hem 13. gün çiziliyor ve ikisi üst üste biniyordu
 * (sütun 22px, etiket 34px). Aynı sebeple ilk etiketin yanındaki de
 * dörtlü adımın dışında kalıyor.
 */
const telefondaGorunur = (i) => ucNokta(i) || (i % 4 === 0 && sonIndeks.value - i >= 3);

/** Masaüstü kademesi telefon kademesini KAPSAR: gizlenen etiket yok, eklenen var. */
const etiketGorunur = (i) => telefondaGorunur(i) || i % 2 === 1;

/*
 * Etiketler kendi sütunlarından geniş (sütun ~22px, "29 Eki" ~32px).
 * Sarma KAPALI, taşan kısım ortalanarak komşu sütunun boşluğuna uzanıyor;
 * iki uçtaki etiketler ise içeri hizalanıyor, yoksa yarısı grafiğin dışına
 * taşardı.
 */
const etiketHizasi = (i) => (i === 0 ? "text-left" : i === sonIndeks.value ? "text-right" : "text-center");
</script>

<template>
  <div v-if="seri.length">
    <div class="relative" :class="yukseklik">
      <svg
        :viewBox="`0 0 ${GENISLIK} ${BOY}`"
        preserveAspectRatio="none"
        class="h-full w-full"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <!--
            Degrade rengi doğrudan tema değişkeninden okunuyor.
            "currentColor" da işe yarardı ama <stop> bir sınıfla renk almak
            için önce o sınıfın "color" üretmesine güveniyor; değişkeni
            yazmak hem kısa hem koyu temada kendiliğinden doğru.
          -->
          <linearGradient :id="degradeId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-brand-500)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--color-brand-500)" stop-opacity="0" />
          </linearGradient>
        </defs>

        <line
          v-for="(y, i) in kilavuz"
          :key="i"
          x1="0"
          :y1="y"
          :x2="GENISLIK"
          :y2="y"
          class="text-ink-200"
          stroke="currentColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />

        <path :d="alan" :fill="`url(#${degradeId})`" />
        <path
          :d="cizgi"
          fill="none"
          class="text-brand-600"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />

        <!-- Seçili günün dikey çizgisi ve noktası. -->
        <template v-if="secili !== null && noktalar[secili]">
          <line
            :x1="noktalar[secili].x"
            y1="0"
            :x2="noktalar[secili].x"
            :y2="BOY"
            class="text-ink-300"
            stroke="currentColor"
            stroke-width="1"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
          />
        </template>
      </svg>

      <!--
        Nokta ve değme alanları SVG'NİN ÜSTÜNDE, normal HTML olarak duruyor.
        SVG yatayda esnediği için içine konan bir daire yumurtaya dönerdi;
        burada daire gerçek bir daire ve dokunma alanı sütunun tamamı
        (telefonda tek bir noktayı parmakla yakalamak mümkün değil).
      -->
      <div class="absolute inset-0 flex">
        <button
          v-for="(nokta, i) in noktalar"
          :key="nokta.date"
          type="button"
          class="group relative min-w-0 flex-1 cursor-default"
          :aria-label="`${kisaTarih(nokta.date)}: ${bicim(nokta.deger)}`"
          @mouseenter="secili = i"
          @focus="secili = i"
          @mouseleave="secili = null"
          @blur="secili = null"
        >
          <span
            class="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand-600 transition-opacity"
            :class="secili === i ? 'opacity-100' : 'opacity-0'"
            :style="{ left: `${(nokta.x / GENISLIK) * 100}%`, top: `${(nokta.y / BOY) * 100}%` }"
          />
        </button>
      </div>

      <!--
        Değer kutusu grafiğin ÜSTÜNDE sabit bir yerde, imlecin yanında değil.
        İmleci takip eden kutu dar ekranda kenardan taşıyor ve kendi gölgesiyle
        okunan noktayı kapatıyordu.
      -->
      <div
        v-if="secili !== null && noktalar[secili]"
        class="pointer-events-none absolute right-0 top-0 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-right shadow-sm"
      >
        <p class="text-[11px] text-ink-500">{{ kisaTarih(noktalar[secili].date) }}</p>
        <p class="text-sm font-semibold text-ink-900">{{ bicim(noktalar[secili].deger) }}</p>
      </div>
    </div>

    <div class="mt-2 flex">
      <div v-for="(nokta, i) in noktalar" :key="nokta.date" class="min-w-0 flex-1" :class="etiketHizasi(i)">
        <span
          v-if="etiketGorunur(i)"
          class="whitespace-nowrap text-[10px] text-ink-400 sm:text-[11px]"
          :class="telefondaGorunur(i) ? 'inline' : 'hidden sm:inline'"
        >
          {{ kisaTarih(nokta.date) }}
        </span>
      </div>
    </div>
  </div>

  <p v-else class="py-10 text-center text-sm text-ink-500">Gösterilecek veri yok.</p>
</template>
