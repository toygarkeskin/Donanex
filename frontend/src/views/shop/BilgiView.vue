<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { BILGI_SAYFALARI, BILGI_ROTALARI, ILETISIM } from "../../content/bilgiSayfalari";
import AlertBox from "../../components/AlertBox.vue";
import AppIcon from "../../components/AppIcon.vue";

/*
 * Bütün bilgilendirme sayfalarını çizen tek görünüm.
 *
 * Hangi sayfa olduğu rotadan "anahtar" olarak geliyor (bkz. router).
 * Metinler content/bilgiSayfalari.js içinde; burada yalnızca düzen var.
 *
 * Ölçü sınırı (max-w-3xl) bilinçli: uzun metin ekran genişliği kadar
 * uzayınca satırlar 150 karaktere çıkıyor ve göz satır başını kaybediyor.
 */
const props = defineProps({
  anahtar: { type: String, required: true }
});

const sayfa = computed(() => BILGI_SAYFALARI[props.anahtar]);

/** Kenardaki "diğer sayfalar" listesi: bulunduğumuz sayfa hariç. */
const digerleri = computed(() =>
  BILGI_ROTALARI.filter((r) => r.anahtar !== props.anahtar).map((r) => ({
    ad: r.ad,
    baslik: BILGI_SAYFALARI[r.anahtar].baslik
  }))
);
</script>

<template>
  <div v-if="sayfa" class="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
    <article class="min-w-0 max-w-3xl">
      <header class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{{ sayfa.baslik }}</h1>
        <p v-if="sayfa.aciklama" class="mt-1.5 text-sm text-ink-500">{{ sayfa.aciklama }}</p>
      </header>

      <!--
        Örnek metin uyarısı SAYFANIN ÜSTÜNDE: hukuki metin gibi görünen bir
        yazının gerçek sanılmaması, okunduktan sonra değil okunmadan önce
        belli olmalı.
      -->
      <AlertBox v-if="sayfa.ornekMetin" tone="warn" class="mb-6">
        Bu metin <strong>örnektir</strong>. Donanex bir okul/demo projesidir; buradaki yazı gerçek bir hukuk
        metni değil, yapının nasıl durduğunu gösteren bir şablondur.
      </AlertBox>

      <div class="space-y-7">
        <section v-for="(bolum, i) in sayfa.bolumler" :key="i">
          <h2 v-if="bolum.baslik" class="mb-2 text-base font-semibold text-ink-900">
            {{ bolum.baslik }}
          </h2>

          <p v-for="(metin, j) in bolum.paragraflar || []" :key="'p' + j" class="text-sm leading-relaxed text-ink-600">
            {{ metin }}
          </p>

          <ul v-if="bolum.liste" class="mt-2 space-y-1.5">
            <li
              v-for="(madde, k) in bolum.liste"
              :key="'l' + k"
              class="flex gap-2 text-sm leading-relaxed text-ink-600"
            >
              <span class="mt-1 shrink-0 text-brand-600"><AppIcon name="onay" :size="14" /></span>
              {{ madde }}
            </li>
          </ul>
        </section>
      </div>

      <div class="card mt-8">
        <h2 class="text-base font-semibold text-ink-900">Bize ulaşın</h2>
        <dl class="mt-3 space-y-1.5 text-sm text-ink-600">
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-ink-500">Telefon:</dt>
            <dd>{{ ILETISIM.telefon }} <span class="text-ink-400">({{ ILETISIM.calismaSaatleri }})</span></dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-ink-500">E-posta:</dt>
            <dd>{{ ILETISIM.eposta }}</dd>
          </div>
        </dl>
        <RouterLink :to="{ name: 'support' }" class="btn-primary mt-4 inline-flex">Destek talebi aç</RouterLink>
      </div>
    </article>

    <!--
      Diğer sayfalar listesi telefonda METNİN ALTINDA, masaüstünde yanda.
      Telefonda yukarıda olsaydı kullanıcı aradığı metne ulaşmak için dokuz
      bağlantıyı geçmek zorunda kalırdı.
    -->
    <aside class="mt-10 lg:mt-0">
      <p class="text-xs font-semibold uppercase tracking-wide text-ink-400">Diğer sayfalar</p>
      <ul class="mt-3 space-y-1">
        <li v-for="d in digerleri" :key="d.ad">
          <RouterLink
            :to="{ name: d.ad }"
            class="block rounded-lg px-2 py-1.5 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          >
            {{ d.baslik }}
          </RouterLink>
        </li>
      </ul>
    </aside>
  </div>
</template>
