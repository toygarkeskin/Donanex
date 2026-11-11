<script setup>
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";

/*
 * Footer'daki bağlantı grubu: telefonda katlanır, sm'den sonra hep açık.
 *
 * Dört grup birden açıkken footer 812px'lik ekranda 698px yer kaplıyordu:
 * kullanıcı sayfanın sonuna geldiğinde neredeyse bir ekran dolusu bağlantı
 * duvarıyla karşılaşıyordu. Telefonda başlıklar kapalı duruyor, footer
 * dörtte birine iniyor ve aranan başlık tek bakışta görünüyor.
 *
 * Masaüstünde katlama YOK: orada yer bol, bağlantıyı bulmak için önce
 * tıklamak gerekmesi gereksiz bir adım olurdu.
 *
 * "!important" kullanılmadı: kapalıyken "hidden sm:block", açıkken sade
 * "block" veriliyor. Böylece masaüstü her iki durumda da açık kalıyor.
 */
defineProps({
  baslik: { type: String, required: true }
});

const acik = ref(false);
</script>

<template>
  <div class="border-b border-ink-200 last:border-b-0 sm:border-b-0">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 py-3 text-left sm:cursor-default sm:py-0"
      :aria-expanded="acik"
      @click="acik = !acik"
    >
      <span class="text-sm font-semibold text-ink-800">{{ baslik }}</span>
      <span class="shrink-0 text-ink-400 transition-transform sm:hidden" :class="acik ? 'rotate-180' : ''">
        <AppIcon name="asagi" :size="16" />
      </span>
    </button>

    <div class="pb-3 sm:pb-0 sm:pt-2" :class="acik ? 'block' : 'hidden sm:block'">
      <slot />
    </div>
  </div>
</template>
