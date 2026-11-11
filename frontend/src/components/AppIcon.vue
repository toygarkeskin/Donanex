<script setup>
/*
 * Arayüz ikonları.
 *
 * Önceden simgeler emoji idi (🛍️ 🏠 🏷️ 👤). Emoji her işletim sisteminde
 * BAŞKA türlü çizilir — Windows'ta düz, iPhone'da parlak ve renkli — yani
 * markanın görünüşü kullanıcının telefonuna kalıyordu. Ayrıca emoji renk
 * almaz: yanındaki yazı griyken simge rengarenk duruyordu.
 *
 * Buradaki ikonlar BrandLogo ile aynı dili konuşuyor: aynı çizgi kalınlığı
 * (1.8), yuvarlatılmış uçlar ve yuvarlatılmış köşeler. Renk currentColor'dan
 * gelir, yani yanındaki yazıyla birlikte değişir ve iki temada da doğru çıkar.
 */
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 22 }
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <!-- Sepet: kulplu çanta. Gövde logodaki çip gövdesi gibi yuvarlatılmış. -->
    <template v-if="name === 'sepet'">
      <path d="M4.6 8.6h14.8l-1.2 10.1a2.6 2.6 0 0 1-2.6 2.3H8.4a2.6 2.6 0 0 1-2.6-2.3L4.6 8.6Z" />
      <path d="M9 8.6V7.1a3 3 0 0 1 6 0v1.5" />
    </template>

    <!-- Ana sayfa -->
    <template v-else-if="name === 'ev'">
      <path d="M3.6 10.4 12 3.8l8.4 6.6" />
      <path d="M5.9 9.6V19a1.6 1.6 0 0 0 1.6 1.6h9A1.6 1.6 0 0 0 18.1 19V9.6" />
      <path d="M9.9 20.6v-5.2h4.2v5.2" />
    </template>

    <!-- Ürünler: dört yuvarlatılmış kare, logodaki çip gövdesinin yankısı -->
    <template v-else-if="name === 'urunler'">
      <rect x="3.6" y="3.6" width="7.2" height="7.2" rx="2.2" />
      <rect x="13.2" y="3.6" width="7.2" height="7.2" rx="2.2" />
      <rect x="3.6" y="13.2" width="7.2" height="7.2" rx="2.2" />
      <rect x="13.2" y="13.2" width="7.2" height="7.2" rx="2.2" />
    </template>

    <!-- Hesap -->
    <template v-else-if="name === 'hesap'">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" />
    </template>

    <!-- Arama -->
    <template v-else-if="name === 'arama'">
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="M15.6 15.6l4.6 4.6" />
    </template>

    <template v-else-if="name === 'sol'">
      <path d="M14.8 5.2 8 12l6.8 6.8" />
    </template>

    <template v-else-if="name === 'sag'">
      <path d="M9.2 5.2 16 12l-6.8 6.8" />
    </template>

    <!-- Mağaza: tenteli dükkân -->
    <template v-else-if="name === 'magaza'">
      <path d="M3.6 8.4h16.8V19a1.6 1.6 0 0 1-1.6 1.6H5.2A1.6 1.6 0 0 1 3.6 19V8.4Z" />
      <path d="M3.6 8.4 5.4 3.8h13.2l1.8 4.6" />
      <path d="M9.6 20.6v-6h4.8v6" />
    </template>

    <!-- Menü -->
    <template v-else-if="name === 'menu'">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </template>

    <!-- Filtre: üç ayar sürgüsü -->
    <template v-else-if="name === 'filtre'">
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h10M18 17h2" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="17" r="2" />
    </template>

    <template v-else-if="name === 'asagi'">
      <path d="M5.2 9.2 12 16l6.8-6.8" />
    </template>

    <template v-else-if="name === 'kapat'">
      <path d="M6 6l12 12M18 6L6 18" />
    </template>

    <!-- Marka etiketi -->
    <template v-else-if="name === 'etiket'">
      <path d="M3.8 11.3V5.2a1.4 1.4 0 0 1 1.4-1.4h6.1a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-5.9 5.9a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z" />
      <circle cx="8.2" cy="8.2" r="1.5" />
    </template>

    <!-- Onay: daire içinde tik -->
    <template v-else-if="name === 'onay'">
      <circle cx="12" cy="12" r="8.6" />
      <path d="M8.4 12.2l2.5 2.5 4.7-4.9" />
    </template>

    <!-- Sipariş takibi: kargo kolisi -->
    <template v-else-if="name === 'kargo'">
      <path d="M3.8 7.6 12 3.6l8.2 4v8.8l-8.2 4-8.2-4V7.6Z" />
      <path d="M3.8 7.6 12 11.7l8.2-4.1M12 11.7v8.7" />
    </template>

    <!--
      Bildirim zili. Gövde logodaki yuvarlatılmış dili sürdürüyor; tokmak
      ayrı bir yay olarak çizildi çünkü tek parça çizgide 18px'te zil ile
      tokmak birbirine giriyor ve simge "tanınmaz bir leke" oluyordu.
    -->
    <template v-else-if="name === 'zil'">
      <path d="M18.3 16.2V11a6.3 6.3 0 1 0-12.6 0v5.2l-1.3 2.1h15.2l-1.3-2.1Z" />
      <path d="M9.9 18.3a2.1 2.1 0 0 0 4.2 0" />
    </template>

    <!-- ----------------------------------------------------- panel simgeleri

         Panel menüsü eskiden emoji kullanıyordu (📊 🏪 👥 📦 💬 ⚙️ 🏷️).
         Vitrin için yazılmış gerekçe (dosyanın başı) panel için de geçerliydi:
         emoji her işletim sisteminde başka çiziliyor, renk almıyor ve koyu
         kenar menüde gri yazının yanında rengarenk duruyordu. -->

    <!-- Genel bakış: çubuk grafik -->
    <template v-else-if="name === 'panel'">
      <path d="M4.2 20.2h15.6" />
      <rect x="5.6" y="12.4" width="3.4" height="5.6" rx="1.2" />
      <rect x="10.3" y="8.2" width="3.4" height="9.8" rx="1.2" />
      <rect x="15" y="4.6" width="3.4" height="13.4" rx="1.2" />
    </template>

    <!-- Kullanıcılar: iki kişi -->
    <template v-else-if="name === 'kullanicilar'">
      <circle cx="9.6" cy="8.4" r="3.2" />
      <path d="M3.4 19.4a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.2 5.6a3.2 3.2 0 0 1 0 5.9M17.6 13.6a5.4 5.4 0 0 1 3 4.6" />
    </template>

    <!-- Destek: konuşma balonu -->
    <template v-else-if="name === 'destek'">
      <path d="M20.4 13.4a6.8 6.8 0 0 1-6.8 6.8H8.3l-4 2.3.9-4.1a6.8 6.8 0 0 1 3.2-12.8h5.2a6.8 6.8 0 0 1 6.8 6.8Z" />
      <path d="M9.4 12.2h.01M12.6 12.2h.01M15.8 12.2h.01" />
    </template>

    <!-- Ayarlar: dişli -->
    <template v-else-if="name === 'ayarlar'">
      <circle cx="12" cy="12" r="2.9" />
      <path
        d="M19.2 14.6a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.97h-.17a1.9 1.9 0 1 1 0-3.8h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.76.32h.08a1.6 1.6 0 0 0 .97-1.46v-.17a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.46.97h.17a1.9 1.9 0 1 1 0 3.8h-.09a1.6 1.6 0 0 0-1.46.97Z"
      />
    </template>

    <!-- Çıkış: kapıdan dışarı ok -->
    <template v-else-if="name === 'cikis'">
      <path d="M9.4 20.4H5.8a1.8 1.8 0 0 1-1.8-1.8V5.4a1.8 1.8 0 0 1 1.8-1.8h3.6" />
      <path d="M15.2 16.4 19.6 12l-4.4-4.4M19.6 12H9.4" />
    </template>

    <!-- Boş durum: açık kapaklı kutu -->
    <template v-else-if="name === 'bos'">
      <path d="M3.6 12.6h4l1.4 2.4h6l1.4-2.4h4" />
      <path d="M5.6 4.6h12.8l2 8v5.2a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8v-5.2l2-8Z" />
    </template>
  </svg>
</template>
