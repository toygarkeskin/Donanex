<script setup>
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { api } from "../../lib/api";
import { sayfayiTanimla } from "../../lib/sayfaBilgisi";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import ProductCard from "../../components/ProductCard.vue";
import BrandAvatar from "../../components/BrandAvatar.vue";
import AppIcon from "../../components/AppIcon.vue";

const route = useRoute();
const marka = ref(null);
const urunler = ref([]);
const yukleniyor = ref(true);
const bulunamadi = ref(false);

async function yukle() {
  yukleniyor.value = true;
  bulunamadi.value = false;
  try {
    marka.value = await api.get(`/brands/${route.params.slug}`);
    sayfayiTanimla(`${marka.value.name} ürünleri`, marka.value.description);
    // Ürünler ürün listesi ucundan geliyor: sıralama, sayfalama ve stok
    // kuralları orada zaten çalışıyor, ikinci kez yazmaya gerek yok.
    const sonuc = await api.get(`/products?brand=${encodeURIComponent(route.params.slug)}&pageSize=24`);
    urunler.value = sonuc.items ?? [];
  } catch {
    bulunamadi.value = true;
    sayfayiTanimla("Marka bulunamadı");
  } finally {
    yukleniyor.value = false;
  }
}

onMounted(yukle);
watch(() => route.params.slug, yukle);
</script>

<template>
  <LoadingBlock v-if="yukleniyor" :rows="4" />

  <EmptyState
    v-else-if="bulunamadi"
    title="Marka bulunamadı"
    description="Aradığınız marka kaldırılmış olabilir."
    icon="🏷️"
  >
    <RouterLink :to="{ name: 'brands' }" class="btn-primary">Markalara dön</RouterLink>
  </EmptyState>

  <div v-else>
    <nav class="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-500" aria-label="Yol">
      <RouterLink :to="{ name: 'brands' }" class="hover:text-brand-600">Markalar</RouterLink>
      <span aria-hidden="true">/</span>
      <span class="text-ink-700">{{ marka.name }}</span>
    </nav>

    <!-- Marka başlığı: işaret, ad, açıklama. -->
    <header class="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <BrandAvatar :brand="marka" size="h-20 w-20" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-bold tracking-tight text-ink-900">{{ marka.name }}</h1>
          <!--
            Rozet YALNIZCA sunucu doğruladığını söylediğinde çiziliyor.
            Şu an hiçbir akış bunu true yapmıyor, yani sahada görünmüyor;
            olmayan bir denetimi varmış gibi göstermemek için böyle.
          -->
          <span
            v-if="marka.verified"
            class="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
          >
            <AppIcon name="onay" :size="13" /> Doğrulanmış marka
          </span>
        </div>
        <p v-if="marka.description" class="mt-1 text-sm leading-relaxed text-ink-600">{{ marka.description }}</p>
        <p class="mt-2 text-sm text-ink-500">
          Vitrinde <strong class="font-semibold text-ink-800">{{ marka.productCount }}</strong> ürün
        </p>
      </div>
    </header>

    <!--
      Bu markayı satan mağazalar.
      "Onaylı satıcı" uydurma bir rozet değil: mağaza, yöneticinin
      başvurusunu onaylamasıyla yayına giriyor. Sistemin gerçekten bildiği
      tek güven işareti bu, o yüzden rozetin ne anlama geldiği de yazıyor.
    -->
    <section v-if="marka.stores?.length" class="mt-6">
      <h2 class="mb-1 text-lg font-bold text-ink-900">Bu markayı satan mağazalar</h2>
      <p class="mb-3 text-xs text-ink-500">
        Onaylı satıcı: başvurusu yönetici tarafından incelenip yayına alınmış mağaza.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <RouterLink
          v-for="magaza in marka.stores"
          :key="magaza.id"
          :to="{ name: 'store', params: { slug: magaza.slug } }"
          class="card flex items-start gap-3 p-4 transition hover:shadow-md"
        >
          <span class="mt-0.5 text-ink-500"><AppIcon name="magaza" :size="20" /></span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate font-semibold text-ink-800">{{ magaza.name }}</p>
              <span
                v-if="magaza.approved"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
              >
                <AppIcon name="onay" :size="13" /> Onaylı satıcı
              </span>
            </div>
            <p class="mt-0.5 line-clamp-2 text-xs text-ink-500">{{ magaza.description }}</p>
            <p class="mt-1 text-xs text-ink-500">{{ magaza.productCount }} {{ marka.name }} ürünü</p>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="mt-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-ink-900">{{ marka.name }} ürünleri</h2>
        <RouterLink
          :to="{ name: 'products', query: { marka: marka.slug } }"
          class="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Filtreleyerek gör →
        </RouterLink>
      </div>

      <EmptyState
        v-if="!urunler.length"
        title="Bu markanın vitrinde ürünü yok"
        description="Mağazalar ürün ekledikçe burada görünecek."
        icon="🔍"
      />
      <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProductCard v-for="urun in urunler" :key="urun.id" :product="urun" />
      </div>
    </section>
  </div>
</template>
