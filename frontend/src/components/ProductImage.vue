<script setup>
/*
 * Ürün görseli kutusu.
 *
 * Tek bir görsel gösterir ve her yerde AYNI zemine oturtur. İşi, oranları
 * birbirini tutmayan fotoğrafların listede aynı çerçevede görünmesini
 * sağlamak.
 *
 * BURADA BİR ZAMANLAR arka planda aynı fotoğrafın bulanık bir kopyası
 * vardı; boş bantları doldurmak içindi. Açık temada göze çarpmıyordu ama
 * koyu temada apaçık görünüyor ve "iki fotoğraf üst üste binmiş" gibi
 * duruyordu. Kaldırıldı: bir ürünün bir fotoğrafı olur.
 *
 * Zemin (--color-urun) İKİ TEMADA DA AÇIK. Ürün fotoğrafları beyaz fonda
 * çekiliyor; koyu bir kutuya konduklarında fotoğrafın kendi beyaz fonu
 * kutunun içinde ayrı bir dikdörtgen gibi duruyor. Açık zeminde fotoğraf
 * kutuyla kaynaşıyor ve bütün liste tek elden çıkmış gibi görünüyor.
 */
defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: "" },
  /** Dar kutularda (sepet satırı gibi) iç boşluk küçülsün. */
  padding: { type: String, default: "p-3" },
  /** Liste dışındaki tek görsellerde tembel yükleme istenmeyebilir. */
  lazy: { type: Boolean, default: true }
});
</script>

<template>
  <div class="flex h-full w-full items-center justify-center overflow-hidden bg-urun">
    <img
      :src="src"
      :alt="alt"
      :loading="lazy ? 'lazy' : 'eager'"
      class="h-full w-full object-contain"
      :class="padding"
    />
  </div>
</template>
