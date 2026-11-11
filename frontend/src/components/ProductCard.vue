<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { money } from "../lib/format";
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
  }
});

const vitrin = computed(() => props.gorunum === "vitrin");

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
    <RouterLink
      :to="{ name: 'product', params: { storeSlug: product.storeSlug, productSlug: product.slug } }"
      class="block aspect-square overflow-hidden transition group-hover:scale-105"
    >
      <ProductImage :src="product.imageUrl" :alt="product.name" />
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
