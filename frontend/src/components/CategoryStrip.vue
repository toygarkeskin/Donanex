<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";

/*
 * Kategori şeridi.
 *
 * Şerit ekrana sığmadığında eskiden tek çıkış yolu yatay kaydırmaydı:
 * masaüstünde fare tekerleği yatay kaydırmaz, kaydırma çubuğu da gizli
 * olduğu için sağdaki kategoriler ULAŞILAMAZ kalıyordu — ve şeridin devam
 * ettiği belli bile olmuyordu.
 *
 * Artık iki ok düğmesi var. Düğmeler yalnızca gerçekten taşma varsa ve
 * yalnızca o yöne gidilecek yer varken görünür: her zaman duran, biri
 * sürekli ölü bir çift ok kullanıcıya yanlış şey söyler.
 */
const props = defineProps({
  categories: { type: Array, default: () => [] }
});

const route = useRoute();
const serit = ref(null);
const solVar = ref(false);
const sagVar = ref(false);

/** Kaydırma konumuna göre hangi okun işe yaradığını hesaplar. */
function oklariGuncelle() {
  const el = serit.value;
  if (!el) return;
  // 2px tolerans: tarayıcılar kesirli piksel döndürdüğü için tam eşitlik
  // sona gelindiğinde bile sağlanmıyor ve ok sönmeden kalıyordu.
  solVar.value = el.scrollLeft > 2;
  sagVar.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
}

/** Bir ekran genişliğinin %80'i kadar kaydırır; kenardaki öğe yarım kalmasın. */
function kaydir(yon) {
  const el = serit.value;
  if (!el) return;
  el.scrollBy({ left: yon * el.clientWidth * 0.8, behavior: "smooth" });
}

onMounted(() => {
  oklariGuncelle();
  window.addEventListener("resize", oklariGuncelle);
});

onBeforeUnmount(() => window.removeEventListener("resize", oklariGuncelle));

// Kategoriler sonradan gelir; DOM güncellenmeden ölçüm yapılamaz.
watch(
  () => props.categories.length,
  () => nextTick(oklariGuncelle)
);
</script>

<template>
  <nav v-if="categories.length" class="border-b border-ink-200 bg-surface" aria-label="Kategoriler">
    <div class="relative mx-auto max-w-7xl px-4">
      <button
        v-if="solVar"
        type="button"
        class="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-ink-200 bg-surface p-1.5 text-ink-600 shadow-sm hover:bg-ink-100 hover:text-ink-900"
        aria-label="Kategorileri sola kaydır"
        @click="kaydir(-1)"
      >
        <AppIcon name="sol" :size="16" />
      </button>

      <div
        ref="serit"
        class="flex gap-1 overflow-x-auto scroll-smooth py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        :class="[solVar ? 'pl-8' : '', sagVar ? 'pr-8' : '']"
        @scroll="oklariGuncelle"
      >
        <RouterLink
          v-for="kategori in categories"
          :key="kategori.id"
          :to="{ name: 'products', query: { kategori: kategori.slug } }"
          class="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          :class="route.query.kategori === kategori.slug ? 'bg-ink-100 text-ink-900' : ''"
        >
          {{ kategori.name }}
        </RouterLink>
      </div>

      <button
        v-if="sagVar"
        type="button"
        class="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-ink-200 bg-surface p-1.5 text-ink-600 shadow-sm hover:bg-ink-100 hover:text-ink-900"
        aria-label="Kategorileri sağa kaydır"
        @click="kaydir(1)"
      >
        <AppIcon name="sag" :size="16" />
      </button>
    </div>
  </nav>
</template>
