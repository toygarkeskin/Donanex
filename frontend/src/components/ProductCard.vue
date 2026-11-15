<script setup>
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { money, gecenSure } from "../lib/format";
import ProductImage from "./ProductImage.vue";

/*
 * Ürün kartı.
 *
 * SEPETE EKLE DÜĞMESİ YOK — bilinçli.
 *
 * Listedeki kart ürünün adını, fotoğrafını ve fiyatını gösterir; stok
 * durumu, açıklaması, satıcısının kargo koşulu ve kaç adet alınacağı ürün
 * sayfasındadır. Listeden tek tıkla sepete atmak, kullanıcıyı neyi
 * aldığını görmeden karar vermeye itiyordu. Trendyol da dahil büyük
 * pazar yerleri kartı bir DAVET olarak kullanır, bir kasa olarak değil.
 *
 * Yan faydası: kart artık yalnızca bağlantılardan oluşuyor; sepete ekleme
 * tek bir yerde (ürün sayfası) yaşıyor.
 */
/*
 * İki görünüm, tek bileşen.
 *
 * "liste": ürün listesinde. Kullanıcı KARŞILAŞTIRIYOR — satıcı kim, stok
 *   az mı, tam ad ne? Bu yüzden yoğun: mağaza adı, iki satırlık başlık ve
 *   stok uyarısı var.
 *
 * "vitrin": ana sayfada. Kullanıcı henüz karşılaştırmıyor, GEZİNİYOR. Orada
 *   mağaza adı ve stok uyarısı gürültü; fotoğraf ve fiyat yeter. Başlık tek
 *   satır, böylece altı altı kart aynı yükseklikte duruyor ve sıra düzgün
 *   görünüyor.
 *
 * İki ayrı bileşen yazmak, ileride kartın bir yerini düzeltip diğerini
 * unutmak demekti.
 */
const props = defineProps({
  product: { type: Object, required: true },
  gorunum: {
    type: String,
    default: "liste",
    validator: (deger) => ["liste", "vitrin"].includes(deger)
  },
  /** "Son gelenler" şeridinde: ürünün ne zaman rafa çıktığını yazar. */
  zamanGoster: { type: Boolean, default: false }
});

const vitrin = computed(() => props.gorunum === "vitrin");

/*
 * Fareyle fotoğraf gezme.
 *
 * Ürünün diğer fotoğraflarını görmek için ürün sayfasına girmek gerekiyordu.
 * Artık fare görselin üstünde YATAY gezdikçe fotoğraf değişiyor: görsel
 * alanı fotoğraf sayısı kadar dilime bölünüyor, fare hangi dilimdeyse o
 * fotoğraf görünüyor. Alttaki çizgiler kaçıncı fotoğrafta olunduğunu söylüyor.
 *
 * YALNIZCA FARE. Dokunmatikte parmak görselin üstünde kaydırırken sayfa
 * kayıyor; aynı hareketi fotoğraf değiştirmeye bağlamak kaydırmayı bozardı.
 * Telefonda görsele dokunmak doğrudan ürün sayfasına götürüyor.
 *
 * Fotoğraflar önceden İNDİRİLMİYOR: yalnızca adresleri listede geliyor,
 * görsel ancak fare o dilime geldiğinde iniyor.
 */
const gorseller = computed(() => {
  const liste = [...new Set([props.product.imageUrl, ...(props.product.previewUrls ?? [])].filter(Boolean))];
  return liste.length ? liste : [props.product.imageUrl];
});
const sira = ref(0);
const cokluGorsel = computed(() => gorseller.value.length > 1);

function gez(olay) {
  if (olay.pointerType && olay.pointerType !== "mouse") return;
  if (!cokluGorsel.value) return;
  const kutu = olay.currentTarget.getBoundingClientRect();
  const oran = Math.min(0.999, Math.max(0, (olay.clientX - kutu.left) / kutu.width));
  sira.value = Math.floor(oran * gorseller.value.length);
}

const birak = () => {
  sira.value = 0;
};

/**
 * Ürün adının marka ÇIKARILMIŞ hâli.
 *
 * Marka ayrı yazıldığı için ad olduğu gibi bırakılsaydı "Logitech Logitech
 * MX Master 3S" çıkardı. Yalnızca ad gerçekten markayla BAŞLIYORSA kırpılır:
 * markası "Microsoft" olup adı "Xbox ..." ile başlayan üründe kırpacak bir
 * şey yok ve "Microsoft Xbox ..." doğru okunuyor.
 */
const adSiz = computed(() => {
  const marka = props.product.brandName ?? "";
  const ad = props.product.name ?? "";
  return marka && ad.toLowerCase().startsWith(`${marka.toLowerCase()} `) ? ad.slice(marka.length + 1) : ad;
});
</script>

<template>
  <!--
    Kare görsel alanı: ürün fotoğrafları çoğunlukla kare çekiliyor, 4:3'te
    yanlarda boşluk kalıyordu. Kare oran kartı bir miktar UZATIR; ekran başına
    düşen ürün sayısındaki artış orandan değil, ızgaranın 4 sütuna çıkması ve
    iç boşlukların daralmasından geliyor.
  -->
  <article class="card group flex flex-col overflow-hidden transition hover:shadow-md">
    <!--
      Tek fotoğraflı üründe eski hafif büyüme duruyor; çok fotoğraflıda
      büyüme kapalı, çünkü fare gezdikçe hem değişen hem büyüyen görsel
      gözü yoruyordu.
    -->
    <RouterLink
      :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }"
      class="relative block aspect-square overflow-hidden"
      @pointermove="gez"
      @pointerleave="birak"
    >
      <div class="h-full w-full transition" :class="cokluGorsel ? '' : 'group-hover:scale-105'">
        <ProductImage :src="gorseller[sira]" :alt="product.name" />
      </div>

      <!-- Kaçıncı fotoğrafta olunduğu: yalnızca fare üstündeyken ve birden
           çok fotoğraf varsa. -->
      <span
        v-if="cokluGorsel"
        class="pointer-events-none absolute inset-x-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      >
        <span
          v-for="(_, i) in gorseller"
          :key="i"
          class="h-1 flex-1 rounded-full"
          :class="i === sira ? 'bg-brand-600' : 'bg-ink-300/70'"
        />
      </span>
    </RouterLink>

    <div class="flex flex-1 flex-col gap-1 p-3">
      <!-- Mağaza adı yalnızca listede: vitrinde karşılaştırma yapılmıyor. -->
      <RouterLink
        v-if="!vitrin"
        :to="{ name: 'store', params: { slug: product.storeSlug } }"
        class="text-xs font-medium text-ink-400 hover:text-brand-600"
      >
        {{ product.storeName }}
      </RouterLink>

      <!--
        Marka ürün adının BAŞINDA ve yalnızca marka adı bağlantılı; gerisi
        ürüne gider. Trendyol'daki "Defacto %100 Pamuk ... Tişört" kalıbı:
        kullanıcı markayı okurken aynı anda ürünü de okuyor, marka için ayrı
        bir satır ya da ayrı bir sayfa gezmek gerekmiyor.

        İki bağlantı İÇ İÇE DEĞİL, yan yana: <a> içine <a> koymak geçersiz
        HTML ve tarayıcı iç bağlantıyı dışarı taşıyıp kartı bozuyor.
        Markası olmayan üründe yalnızca ad yazılıyor.
      -->
      <h3
        class="flex-1 text-sm leading-snug text-ink-800"
        :class="vitrin ? 'line-clamp-1' : 'line-clamp-2'"
      >
        <RouterLink
          v-if="product.brandSlug"
          :to="{ name: 'brand', params: { slug: product.brandSlug } }"
          class="font-bold text-ink-900 hover:text-brand-600 hover:underline"
          @click.stop
        >
          {{ product.brandName }}
        </RouterLink>
        <!--
          Açık boşluk: Vue şablonu iki etiket ARASINDAKİ satır sonunu siler,
          bu yüzden marka ile ürün adı "LogitechMX Master 3S" diye bitişik
          çıkıyordu. &#32; de işe yaramıyor — derleyici onu çözüp boşluk
          sıkıştırmasına takılıyor. İFADE olarak yazılan boşluk duruyor.
        -->
        <span>{{ " " }}</span>
        <RouterLink
          :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }"
          class="font-medium"
        >
          {{ product.brandSlug ? adSiz : product.name }}
        </RouterLink>
      </h3>

      <!--
        Fiyat kartın en güçlü öğesi: düğme gittiği için kullanıcının aradığı
        bilgi bu. Marka mavisiyle yazılıyor, böylece ızgarada göz fiyattan
        fiyata atlayabiliyor.
      -->
      <p class="mt-1 text-lg font-bold leading-tight text-brand-600">{{ money(product.price) }}</p>

      <!-- "Son gelenler" şeridinde rafa çıkış zamanı: "2 gün önce". -->
      <p v-if="zamanGoster && product.publishedAt" class="text-xs text-ink-400">
        {{ gecenSure(product.publishedAt) }}
      </p>

      <!--
        Stok uyarısı yalnızca listede. Vitrinde "Son 2 ürün" bir aciliyet
        rozetine dönüşüyor; kullanıcı henüz o ürünü almaya karar vermemişken
        acele ettirmek, gezinmeyi baskıya çeviriyor. Listede ise iki ürün
        arasında seçim yapan kişi için gerçek bir bilgi.
      -->
      <template v-if="!vitrin">
        <p v-if="product.stock > 0 && product.stock <= 5" class="text-xs font-medium text-amber-700">
          Son {{ product.stock }} ürün
        </p>
        <p v-else-if="product.stock <= 0" class="text-xs font-medium text-red-600">Stokta yok</p>
      </template>
    </div>
  </article>
</template>
