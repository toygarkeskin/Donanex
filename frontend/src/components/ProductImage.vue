<script setup>
/*
 * Ürün görseli kutusu.
 *
 * SORUN: katalogdaki fotoğrafların oranı 0.67 ile 2.44 arasında değişiyor
 * (kimi kare, kimi 1464x600). Hepsi aynı kare kutuya konunca:
 *   - object-contain ile geniş fotoğraf kutunun yalnızca %41'ini dolduruyor,
 *     üstte ve altta kocaman boş gri bantlar kalıyordu;
 *   - object-cover ile kutu doluyor ama ürün KESİLİYOR — kulaklığın yarısı,
 *     kumandanın bir tanesi kadraj dışında kalıyordu.
 *
 * ÇÖZÜM: fotoğraf yine contain, yani hiçbir şey kırpılmıyor; arkasına da
 * aynı fotoğrafın bulanık ve büyütülmüş bir kopyası konuyor. Böylece kutu
 * kenardan kenara dolu görünüyor, boş bant kalmıyor ve ürünün hiçbir yeri
 * kesilmiyor. Kare fotoğraflarda arka plan zaten hiç görünmez.
 *
 * Arka plan AYNI dosya: tarayıcı ikinci kez indirmez, önbellekten çizer.
 *
 * aria-hidden + boş alt: arkadaki kopya bir bilgi taşımıyor, ekran
 * okuyucunun aynı görseli iki kez okuması gerekmiyor.
 */
defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: "" },
  /** Dar kutularda (sepet satırı gibi) iç boşluk küçülsün. */
  padding: { type: String, default: "p-3" },
  /**
   * Bulanıklık yarıçapı kutuya göre ayarlanır: 40 pikselik bir küçük resimde
   * 24px bulanıklık görüntüyü düz bir renk lekesine çevirir.
   */
  blurClass: { type: String, default: "blur-xl" },
  /** Liste dışındaki tek görsellerde tembel yükleme istenmeyebilir. */
  lazy: { type: Boolean, default: true }
});
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-ink-100">
    <img
      :src="src"
      alt=""
      aria-hidden="true"
      :loading="lazy ? 'lazy' : 'eager'"
      class="absolute inset-0 h-full w-full scale-125 object-cover opacity-55"
      :class="blurClass"
    />
    <img
      :src="src"
      :alt="alt"
      :loading="lazy ? 'lazy' : 'eager'"
      class="relative h-full w-full object-contain"
      :class="padding"
    />
  </div>
</template>
