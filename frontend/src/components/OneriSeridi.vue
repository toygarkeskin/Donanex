<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { api, query } from "../lib/api";
import { money } from "../lib/format";
import { useCartStore } from "../stores/cart";
import { useToastStore } from "../stores/toast";
import ProductImage from "./ProductImage.vue";
import YataySerit from "./YataySerit.vue";

/*
 * "Bunları da sepete ekleyebilirsiniz" şeridi.
 *
 * Öneriler TAMAMLAYICI: sepette mouse varsa klavye, mousepad, kulaklık
 * geliyor — bir mouse daha değil (kural sunucuda, domain/catalog/Complements).
 * Ürün verilmezse (boş sepet) farklı kategorilerden en yeni ürünler geliyor.
 *
 * Bu şeritteki kartta SEPETE EKLE DÜĞMESİ VAR — normal ürün kartında yok.
 * Fark bilinçli: liste kartı bir davet (önce ürüne bak), bu şerit ise zaten
 * alışveriş yapan birine "bunu da unutma" diyor. Kullanıcı tamamlayıcı ürünü
 * ana ürünün yanında tanıyor; ayrı sayfaya gidip dönmek onu akıştan koparırdı.
 *
 * Şerit yatay kayıyor (oklar başlık satırında, telefonda parmakla):
 * sitedeki uygun ürün sayısı kadar öneri sığıyor, sayfa uzamıyor.
 */
const props = defineProps({
  urunIdleri: { type: Array, default: () => [] },
  baslik: { type: String, default: "Bunları da sepete ekleyebilirsiniz" },
  adet: { type: Number, default: 24 }
});

const cart = useCartStore();
const toast = useToastStore();
const oneriler = ref([]);
const ekleniyor = ref(null);

/* Kimlik listesi değişmedikçe yeniden istek atılmıyor (sıra önemsiz). */
const anahtar = computed(() => [...props.urunIdleri].sort().join(","));

async function yukle() {
  try {
    const sonuc = await api.get(`/oneriler${query({ adet: props.adet })}${props.urunIdleri.map((id) => `&urun=${id}`).join("")}`);
    oneriler.value = sonuc.items ?? [];
  } catch {
    // Öneri yüklenemezse şerit hiç çizilmiyor; sayfanın geri kalanı etkilenmesin.
    oneriler.value = [];
  }
}

watch(anahtar, yukle, { immediate: true });

async function ekle(urun) {
  ekleniyor.value = urun.id;
  try {
    await cart.add(urun.id, 1);
    toast.success(`${urun.name} sepete eklendi.`);
  } catch (error) {
    toast.error(error.message);
  } finally {
    ekleniyor.value = null;
  }
}

const sepette = (id) => cart.items.some((kalem) => kalem.productId === id);
</script>

<template>
  <section v-if="oneriler.length">
    <YataySerit :etiket="baslik" :baslik="baslik">
      <article
        v-for="urun in oneriler"
        :key="urun.id"
        class="card flex w-40 shrink-0 snap-start flex-col overflow-hidden sm:w-44"
      >
        <RouterLink
          :to="{ name: 'product', params: { storeSlug: urun.storeSlug, productSlug: urun.slug } }"
          class="block aspect-square overflow-hidden"
        >
          <ProductImage :src="urun.imageUrl" :alt="urun.name" />
        </RouterLink>
        <div class="flex flex-1 flex-col gap-1 p-2.5">
          <p class="text-[11px] font-medium uppercase tracking-wide text-ink-400">{{ urun.categoryName }}</p>
          <RouterLink
            :to="{ name: 'product', params: { storeSlug: urun.storeSlug, productSlug: urun.slug } }"
            class="line-clamp-2 flex-1 text-sm leading-snug text-ink-800 hover:text-brand-600"
          >
            {{ urun.name }}
          </RouterLink>
          <p class="text-base font-bold text-brand-600">{{ money(urun.price) }}</p>
          <button
            type="button"
            class="btn-secondary mt-1 w-full px-2 py-1.5 text-xs"
            :disabled="ekleniyor === urun.id"
            @click="ekle(urun)"
          >
            {{ ekleniyor === urun.id ? "Ekleniyor…" : sepette(urun.id) ? "Bir tane daha" : "Sepete ekle" }}
          </button>
        </div>
      </article>
    </YataySerit>
  </section>
</template>
