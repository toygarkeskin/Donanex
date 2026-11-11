<script setup>
import { RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";
import ToastHost from "./components/ToastHost.vue";
import AcilisEkrani from "./components/AcilisEkrani.vue";

/*
 * Açılışta oturum geri alınana kadar açılış ekranı duruyor.
 *
 * Router'ın ilk gezinmesi auth.restore() bitene kadar bekliyor, yani
 * RouterView zaten boş. Önceden o boşluk BEYAZ/BOŞ bir ekrandı; telefonda
 * uygulama olarak açıldığında açılmamış gibi görünüyordu.
 *
 * Kısa yüklemelerde bir an parlayıp gitmesi, boş ekrandan iyi: kullanıcı
 * hiçbir şey görmemektense markayı görüyor.
 */
const auth = useAuthStore();
</script>

<template>
  <AcilisEkrani v-if="!auth.ready" />
  <RouterView />
  <ToastHost />
</template>
