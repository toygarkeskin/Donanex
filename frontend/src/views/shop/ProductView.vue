<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { useCartStore } from "../../stores/cart";
import { useToastStore } from "../../stores/toast";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import AlertBox from "../../components/AlertBox.vue";
import ProductCard from "../../components/ProductCard.vue";
import ProductImage from "../../components/ProductImage.vue";
import { sayfayiTanimla } from "../../lib/sayfaBilgisi";

const route = useRoute();
const cart = useCartStore();
const toast = useToastStore();

const product = ref(null);
const loading = ref(true);
const notFound = ref(false);
const quantity = ref(1);
const adding = ref(false);
const benzerler = ref([]);

/*
 * Görsel galerisi.
 *
 * Kapak (imageUrl) listenin BAŞINDA: ürün kartında, sepette ve sipariş
 * kaydında görünen görsel o, yani kullanıcının tıklayarak geldiği görsel.
 * Önce başka bir kare göstermek, yanlış ürüne girdim hissi verirdi.
 *
 * Tek görseli olan ürünlerde küçük resim şeridi hiç çizilmiyor: tek karelik
 * bir "galeri" yer kaplamaktan başka bir şey yapmaz.
 */
const seciliGorsel = ref(0);

const gorseller = computed(() => {
  if (!product.value) return [];
  const liste = [product.value.imageUrl, ...(product.value.galleryUrls ?? [])];
  return [...new Set(liste.filter(Boolean))];
});

const acikGorsel = computed(() => gorseller.value[seciliGorsel.value] ?? product.value?.imageUrl);

/**
 * Aynı kategorideki diğer ürünler.
 *
 * Ürünün kendisi listeden çıkarılır ve en fazla dört tane gösterilir.
 * Bulunamazsa bölüm hiç çizilmez — boş bir "Benzer ürünler" başlığı
 * göstermek, öneri varmış gibi durup olmamasından daha kötü.
 */
async function benzerleriYukle() {
  benzerler.value = [];
  if (!product.value?.categorySlug) return;
  try {
    const sonuc = await api.get(`/products?category=${encodeURIComponent(product.value.categorySlug)}&pageSize=8`);
    benzerler.value = (sonuc.items ?? []).filter((aday) => aday.id !== product.value.id).slice(0, 4);
  } catch {
    /* öneri getirilemezse sayfa olduğu gibi çalışır */
  }
}

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    product.value = await api.get(`/products/${route.params.storeSlug}/${route.params.productSlug}`);
    quantity.value = 1;
    // Başka bir ürüne geçildiğinde seçim sıfırlanmazsa, yeni üründe
    // 3. görsel seçili kalır ya da hiç olmayan bir karenin indisi gösterilir.
    seciliGorsel.value = 0;
    // Sekme başlığı ve açıklama ürünün kendi adıyla yazılır; router genel
    // bir başlık koymuştu, veri gelince onun yerini alır.
    sayfayiTanimla(`${product.value.name} — ${product.value.storeName}`, product.value.description);
    benzerleriYukle();
  } catch {
    notFound.value = true;
    sayfayiTanimla("Ürün bulunamadı");
  } finally {
    loading.value = false;
  }
}

async function addToCart() {
  adding.value = true;
  try {
    await cart.add(product.value.id, Number(quantity.value));
    toast.success(`${product.value.name} sepete eklendi.`);
  } catch (error) {
    toast.error(error.message);
  } finally {
    adding.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);
</script>

<template>
  <LoadingBlock v-if="loading" :rows="4" />

  <EmptyState
    v-else-if="notFound"
    title="Ürün bulunamadı"
    description="Ürün kaldırılmış ya da satıcı mağazasını kapatmış olabilir."
    icon="🔍"
  >
    <RouterLink :to="{ name: 'products' }" class="btn-primary">Ürünlere dön</RouterLink>
  </EmptyState>

  <div v-else class="grid gap-5 lg:grid-cols-2 lg:gap-8">
    <!--
      Telefonda görsel alçak tutuluyor: 420px'te "Sepete ekle" katlamanın
      altında kalıyor ve satın almak için kaydırmak gerekiyordu. Geniş ekranda
      iki sütun yan yana olduğu için böyle bir sorun yok, görsel büyük kalıyor.
    -->
    <div>
      <!--
        Sabit oran: fotoğrafın oranına göre kutu boy değiştirdiğinde, ürün
        değiştikçe ya da galeride geçiş yapıldıkça altındaki her şey zıplıyordu.
        Kare kutu + ProductImage, geniş fotoğrafta da boş bant bırakmıyor.
      -->
      <div class="card aspect-square overflow-hidden">
        <ProductImage :src="acikGorsel" :alt="product.name" padding="p-4 sm:p-8" :lazy="false" />
      </div>

      <!-- Küçük resimler yalnızca birden çok görsel varsa. -->
      <div v-if="gorseller.length > 1" class="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          v-for="(adres, sira) in gorseller"
          :key="adres"
          type="button"
          class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition"
          :class="sira === seciliGorsel ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-ink-200 hover:border-ink-300'"
          :aria-label="`${sira + 1}. görseli göster`"
          :aria-pressed="sira === seciliGorsel"
          @click="seciliGorsel = sira"
        >
          <ProductImage :src="adres" padding="p-1" />
        </button>
      </div>
    </div>

    <div>
      <nav class="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-500" aria-label="Yol">
        <RouterLink :to="{ name: 'products' }" class="hover:text-brand-600">Ürünler</RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink
          v-if="product.categorySlug"
          :to="{ name: 'products', query: { kategori: product.categorySlug } }"
          class="hover:text-brand-600"
        >
          {{ product.categoryName }}
        </RouterLink>
      </nav>

      <h1 class="text-2xl font-bold tracking-tight text-ink-900">{{ product.name }}</h1>

      <RouterLink
        :to="{ name: 'store', params: { slug: product.storeSlug } }"
        class="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        🏪 {{ product.storeName }}
      </RouterLink>

      <!--
        Açıklama fiyatın ÜSTÜNDE.
        Önceden sıra şöyleydi: fiyat, stok, adet, sepete ekle, uyarı — ve
        ancak ondan sonra açıklama. Oysa kullanıcı bir ürüne tıkladığında
        önce "bu ne?" diye bakar, fiyata kararını ondan sonra verir. Telefonda
        açıklama katlamanın çok altında kalıyordu.
      -->
      <div class="mt-4">
        <h2 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Ürün açıklaması</h2>
        <p class="whitespace-pre-line text-sm leading-relaxed text-ink-700">{{ product.description }}</p>
      </div>

      <!--
        Satın alma kutusu: SOLDA adet ve düğme, SAĞDA fiyat — telefonda da
        aynı satırda. Ölçüler 375px'e göre seçildi (adet 56px + düğme ~105px
        + fiyat ~112px), bu yüzden alta atmıyor. 320px gibi daha dar bir
        ekranda flex-wrap devreye girer: yatay kaydırma yerine düzgün bir
        alt satır.
      -->
      <div class="card mt-4 p-3 sm:p-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div v-if="product.stock > 0" class="flex items-end gap-2">
            <div>
              <label for="quantity" class="mb-1 block text-[11px] font-medium text-ink-500">Adet</label>
              <input
                id="quantity"
                v-model="quantity"
                type="number"
                min="1"
                :max="Math.min(99, product.stock)"
                class="field h-10 w-14 px-2 text-center"
              />
            </div>
            <button
              type="button"
              class="btn-primary h-10 shrink-0 px-4 text-sm sm:px-6"
              :disabled="adding"
              @click="addToCart"
            >
              {{ adding ? "Ekleniyor…" : "Sepete ekle" }}
            </button>
          </div>
          <p v-else class="text-sm font-medium text-red-600">Bu ürün şu anda stokta yok.</p>

          <div class="ml-auto text-right">
            <p class="text-xl font-bold text-ink-900 sm:text-3xl">{{ money(product.price) }}</p>
            <p v-if="product.stock > 0" class="mt-0.5 text-xs text-ink-500">
              Stokta <strong class="font-semibold text-ink-700">{{ product.stock }}</strong> adet
            </p>
          </div>
        </div>
      </div>

      <AlertBox v-if="product.stock > 0 && product.stock <= 5" tone="warn" class="mt-3">
        Son {{ product.stock }} ürün — stok bitmeden sipariş verin.
      </AlertBox>

      <dl v-if="product.sku" class="mt-4 flex gap-2 text-sm">
        <dt class="text-ink-500">Stok kodu:</dt>
        <dd class="font-medium text-ink-800">{{ product.sku }}</dd>
      </dl>

      <!--
        Teslimat ve satıcı bilgisi. Burada yalnızca sistemin GERÇEKTEN
        bildiği şeyler yazıyor: kargo ücretsiz (sepet de böyle hesaplıyor),
        gönderim satıcıdan yapılıyor ve sipariş takip edilebiliyor.
        Tahmini teslim tarihi YOK — öyle bir veri tutulmuyor, uydurmak
        müşteriye yanlış söz vermek olurdu.
      -->
      <div class="mt-5 space-y-3">
        <div class="card flex items-start gap-3 p-4">
          <span class="text-lg" aria-hidden="true">🚚</span>
          <div class="text-sm">
            <p class="font-semibold text-ink-800">Kargo ücretsiz</p>
            <p class="mt-0.5 text-ink-500">
              Ürün <strong class="font-medium text-ink-700">{{ product.storeName }}</strong> tarafından gönderilir.
              Siparişinizi kargoya verildikten sonra takip edebilirsiniz.
            </p>
          </div>
        </div>

        <div class="card flex items-center justify-between gap-3 p-4">
          <div class="min-w-0 text-sm">
            <p class="text-ink-500">Satıcı</p>
            <p class="truncate font-semibold text-ink-800">{{ product.storeName }}</p>
          </div>
          <RouterLink
            :to="{ name: 'store', params: { slug: product.storeSlug } }"
            class="btn-secondary shrink-0 py-1.5 text-sm"
          >
            Mağazaya git
          </RouterLink>
        </div>
      </div>
    </div>

    <section v-if="benzerler.length" class="lg:col-span-2">
      <h2 class="mb-4 text-lg font-bold text-ink-900">Benzer ürünler</h2>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProductCard v-for="benzer in benzerler" :key="benzer.id" :product="benzer" />
      </div>
    </section>
  </div>
</template>
