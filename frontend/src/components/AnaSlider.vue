<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import ProductImage from "./ProductImage.vue";
import AppIcon from "./AppIcon.vue";

/*
 * Ana sayfa vitrin kaydırıcısı.
 *
 * Görseller ve başlıklar CANLI veriden: her slayt bir kategori ve o
 * kategorideki en yeni ürünün fotoğrafı. Hazır "kampanya" görseli
 * kullanılmadı — bakımı olan ayrı bir içerik, güncellenmediği gün eski bir
 * kampanyayı gösteren bir afişe dönüşürdü. Burada ürün eklendikçe afiş de
 * kendiliğinden tazeleniyor.
 *
 * Kendiliğinden ilerliyor (6 sn) ama:
 *  - fare üstündeyken ya da klavye odağı içindeyken DURUYOR: okunan metin
 *    elden kaçmasın,
 *  - "hareketi azalt" açık kullanıcıda HİÇ ilerlemiyor,
 *  - sekme arka plandayken duruyor (boşuna tur atmasın).
 * Telefonda parmakla sağa/sola kaydırılabiliyor.
 */
const props = defineProps({
  kategoriler: { type: Array, default: () => [] },
  urunSayisi: { type: Number, default: 0 },
  magazaSayisi: { type: Number, default: 0 }
});

/* Bilinen kategoriler için elle yazılmış başlık; bilinmeyen için genel kalıp. */
const METINLER = {
  "ekran-karti": { baslik: "Ekran kartlarında yeni sezon", alt: "Oyunda ve tasarımda performansı ikiye katlayın." },
  laptop: { baslik: "Her işe bir dizüstü", alt: "Oyuncudan iş bilgisayarına, tek yerde." },
  klavye: { baslik: "Yazdıkça hissedin", alt: "Mekanik ve oyuncu klavyeleri bir arada." },
  mouse: { baslik: "İsabetli her tık", alt: "Kablosuz, hafif, oyuncu mouse'ları." },
  monitor: { baslik: "Daha geniş, daha akıcı", alt: "Yüksek yenileme hızlı oyuncu monitörleri." },
  kulaklik: { baslik: "Sesin tamamı", alt: "Oyun ve müzik için kulaklıklar." },
  depolama: { baslik: "Hızlı ve geniş depolama", alt: "NVMe SSD'lerle saniyeler içinde açılış." },
  islemci: { baslik: "Sistemin beyni", alt: "Yeni nesil işlemciler." }
};

const slaytlar = computed(() => {
  const kategoriSlaytlari = [...props.kategoriler]
    .filter((k) => k.imageUrl && k.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 4)
    .map((k) => ({
      anahtar: k.slug,
      ust: k.name,
      baslik: METINLER[k.slug]?.baslik ?? `${k.name} seçkisi`,
      alt: METINLER[k.slug]?.alt ?? `${k.productCount} ürün, farklı mağazalardan.`,
      gorsel: k.imageUrl,
      hedef: { name: "products", query: { kategori: k.slug } },
      dugme: `${k.name} ürünleri`
    }));

  return [
    {
      anahtar: "genel",
      ust: "Donanex",
      baslik: "Onlarca mağaza, tek sepet, tek ödeme.",
      alt:
        props.urunSayisi && props.magazaSayisi
          ? `${props.magazaSayisi} mağazadan ${props.urunSayisi} ürün. Üye olmadan da sipariş verebilirsiniz.`
          : "Gezmek ve sepete eklemek için üye olmanıza gerek yok.",
      gorsel: kategoriSlaytlari[0]?.gorsel ?? null,
      hedef: { name: "products" },
      dugme: "Ürünleri keşfet"
    },
    ...kategoriSlaytlari
  ];
});

const aktif = ref(0);
const durdu = ref(false);
let zamanlayici = null;
const hareketAzalt =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const git = (i) => {
  const n = slaytlar.value.length;
  aktif.value = (i + n) % n;
};
const ileri = () => git(aktif.value + 1);
const geri = () => git(aktif.value - 1);

function baslat() {
  if (hareketAzalt) return;
  durdur();
  zamanlayici = setInterval(() => {
    if (!durdu.value && !document.hidden) ileri();
  }, 6000);
}
function durdur() {
  clearInterval(zamanlayici);
  zamanlayici = null;
}

/* Parmakla kaydırma: 40px'ten kısa hareket dokunma sayılıyor, bağlantı açılsın. */
let baslangicX = null;
const dokunBasla = (olay) => {
  if (olay.pointerType !== "mouse") baslangicX = olay.clientX;
};
const dokunBitir = (olay) => {
  if (baslangicX === null) return;
  const fark = olay.clientX - baslangicX;
  baslangicX = null;
  if (Math.abs(fark) > 40) (fark < 0 ? ileri : geri)();
};

onMounted(baslat);
onBeforeUnmount(durdur);
</script>

<template>
  <section
    class="relative overflow-hidden rounded-2xl bg-night text-white"
    aria-roledescription="kaydırıcı"
    aria-label="Öne çıkanlar"
    @mouseenter="durdu = true"
    @mouseleave="durdu = false"
    @focusin="durdu = true"
    @focusout="durdu = false"
    @pointerdown="dokunBasla"
    @pointerup="dokunBitir"
  >
    <!--
      Slaytlar üst üste duruyor, yalnızca opaklık değişiyor (kayma değil):
      kayan bir şerit yükseklik farkında zıplıyor ve metni okurken göz
      kaçıyordu. Yükseklik en uzun slayda göre sabit.
    -->
    <div class="grid">
      <div
        v-for="(slayt, i) in slaytlar"
        :key="slayt.anahtar"
        class="col-start-1 row-start-1 grid items-center gap-6 px-6 py-7 transition-opacity duration-500 sm:grid-cols-[minmax(0,1fr)_200px] sm:px-10 lg:grid-cols-[minmax(0,1fr)_240px]"
        :class="i === aktif ? 'opacity-100' : 'pointer-events-none opacity-0'"
        :aria-hidden="i !== aktif"
        role="group"
        :aria-label="`${i + 1} / ${slaytlar.length}`"
      >
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-night-accent">{{ slayt.ust }}</p>
          <h2 class="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{{ slayt.baslik }}</h2>
          <p class="mt-1.5 text-sm text-night-muted">{{ slayt.alt }}</p>
          <RouterLink
            :to="slayt.hedef"
            class="btn mt-4 bg-white px-5 py-2.5 text-night hover:bg-white/90"
            :tabindex="i === aktif ? 0 : -1"
          >
            {{ slayt.dugme }}
          </RouterLink>
        </div>

        <!-- Ürün fotoğrafı beyaz fonlu; açık bir karo içinde koyu banda oturuyor.
             Telefonda yer dar, fotoğraf gizli. -->
        <div v-if="slayt.gorsel" class="hidden aspect-square overflow-hidden rounded-xl bg-urun sm:block">
          <ProductImage :src="slayt.gorsel" alt="" padding="p-4" />
        </div>
      </div>
    </div>

    <template v-if="slaytlar.length > 1">
      <div class="absolute bottom-3 left-6 flex gap-1.5 sm:left-10">
        <button
          v-for="(slayt, i) in slaytlar"
          :key="slayt.anahtar"
          type="button"
          class="h-1.5 rounded-full transition-all"
          :class="i === aktif ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'"
          :aria-label="`${i + 1}. slayt`"
          :aria-current="i === aktif"
          @click="git(i)"
        />
      </div>

      <!-- Oklar yalnızca fareyle gezilen ekranda; telefonda kaydırma var. -->
      <div class="absolute bottom-2 right-3 hidden gap-1 sm:flex">
        <button type="button" class="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Önceki" @click="geri">
          <AppIcon name="sol" :size="18" />
        </button>
        <button type="button" class="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Sonraki" @click="ileri">
          <AppIcon name="sag" :size="18" />
        </button>
      </div>
    </template>
  </section>
</template>
