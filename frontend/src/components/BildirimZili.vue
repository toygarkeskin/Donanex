<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBildirimStore } from "../stores/bildirim";
import { gecenSure, formatDate } from "../lib/format";
import AppIcon from "./AppIcon.vue";

/*
 * Bildirim zili ve paneli.
 *
 * Aynı bileşen üç yerde kullanılıyor — başlıkta (kişisel), mağaza panelinde
 * ve yönetim panelinde. Hangi kutuyu göstereceğini "kutu" özelliği söylüyor;
 * veri ve okundu işaretleri tek mağazada durduğu için bileşenin kendi
 * durumu yalnızca "panel açık mı" sorusundan ibaret.
 *
 * Panel her boyutta zile bağlı bir açılır kutu; genişliği telefonda ekrana
 * göre daralıyor. Neden aşağıdan açılan bir tabaka OLMADIĞI şablondaki
 * yorumda yazıyor — kısaca: zil, arka plan süzgeci olan yapışkan başlığın
 * içinde ve orada "position: fixed" ekrana göre değil başlığa göre
 * konumlanıyor.
 */
const props = defineProps({
  kutu: { type: String, default: "mine" }
});

const bildirimler = useBildirimStore();
const router = useRouter();
const route = useRoute();

const acik = ref(false);
const sarmalayici = ref(null);

const kutu = computed(() => bildirimler.kutu(props.kutu));
const okunmamis = computed(() => kutu.value.unread);

/** Rozette gösterilecek sayı; üçten fazla hane rozeti şişiriyor. */
const rozet = computed(() => (okunmamis.value > 99 ? "99+" : String(okunmamis.value)));

/*
 * Bildirim türüne göre simge.
 *
 * Tür adının ÖN EKİNE bakılıyor ("order.", "support."), tam adına değil:
 * her yeni olay tipi için buraya satır eklemek gerekmesin. Eşleşmeyen tür
 * zil simgesiyle çiziliyor — bilinmeyen bir tür yüzünden satır simgesiz
 * kalmıyor.
 */
const SIMGELER = [
  ["order.package_shipped", "kargo"],
  ["order.package_delivered", "onay"],
  ["order.", "sepet"],
  ["support.", "etiket"],
  ["store.", "magaza"],
  ["user.", "hesap"]
];

const simge = (kind) => SIMGELER.find(([onek]) => String(kind).startsWith(onek))?.[1] ?? "zil";

async function ac() {
  acik.value = !acik.value;
  if (acik.value) await bildirimler.kutuyuAc(props.kutu);
}

/**
 * Bildirime tıklama.
 *
 * Okundu işareti ÖNCE konuyor, yönlendirme sonra: sıra ters olsaydı sayfa
 * değişimi bileşeni söküp isteği yarıda bırakabilirdi.
 *
 * Yol site içi olduğu için router.push kullanılıyor; sunucudan gelen değer
 * yine de denetleniyor — "/" ile başlamayan bir değer varsa yönlendirme hiç
 * yapılmıyor, çünkü böyle bir değer dışarıya açılan bir adres olabilir.
 */
async function tikla(bildirim) {
  await bildirimler.okundu(props.kutu, bildirim.id);
  acik.value = false;
  const yol = String(bildirim.url ?? "");
  if (yol.startsWith("/") && !yol.startsWith("//")) router.push(yol);
}

function disaridaTiklandi(olay) {
  if (sarmalayici.value && !sarmalayici.value.contains(olay.target)) acik.value = false;
}

function tusaBasildi(olay) {
  if (olay.key === "Escape") acik.value = false;
}

onMounted(() => {
  document.addEventListener("click", disaridaTiklandi);
  document.addEventListener("keydown", tusaBasildi);
  // Sayaç panel açılmadan da görünmeli: kutu ilk kez burada isteniyor.
  bildirimler.kutuyuAc(props.kutu);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", disaridaTiklandi);
  document.removeEventListener("keydown", tusaBasildi);
});

// Sayfa değişince açık panel kapanır.
watch(
  () => route.fullPath,
  () => {
    acik.value = false;
  }
);

// Panel adresi mağazadan mağazaya değişebilir; yeni kutu da yüklenmeli.
watch(
  () => props.kutu,
  (yeni) => bildirimler.kutuyuAc(yeni)
);
</script>

<template>
  <!--
    Sarmalayıcı telefonda "static", sm'den sonra "relative".

    Konumlandırma kapsayıcısını bu belirliyor. Telefonda sarmalayıcı
    konumlandırılmış olsaydı panel ZİLE göre hizalanırdı; zil ise sağdaki
    son öğe değil (yanında tema, hesap ve menü düğmeleri var), bu yüzden
    343px'lik panelin sol kenarı ekranın 134px dışında kalıyordu. Statikken
    kapsayıcı yapışkan başlık oluyor ve panel sayfanın kendi kenar boşluğuna
    (16px) hizalanıyor. Masaüstünde yer bol, orada zile hizalanması doğru.
  -->
  <div ref="sarmalayici" class="static sm:relative">
    <button
      type="button"
      class="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900"
      :aria-expanded="acik"
      :aria-label="okunmamis ? `Bildirimler (${okunmamis} okunmamış)` : 'Bildirimler'"
      @click="ac"
    >
      <AppIcon name="zil" />
      <span
        v-if="okunmamis > 0"
        class="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs font-bold leading-5 text-white"
      >
        {{ rozet }}
      </span>
    </button>

    <!--
      Panel HER BOYUTTA zile bağlı bir açılır kutu; telefonda aşağıdan açılan
      bir tabaka DEĞİL.

      Tabaka denendi ve ölçümde çalışmadı: zil, yapışkan başlığın içinde
      duruyor ve başlıkta "backdrop-blur" var. Arka plan süzgeci olan bir
      öğe, içindeki "position: fixed" öğeler için YENİ BİR KAPSAYICI BLOK
      kuruyor — yani tabaka ekranın altına değil BAŞLIĞIN altına yapışıyor,
      mat zemin de yalnızca başlığı karartıyordu. Teleport ile gövdeye taşımak
      çözerdi ama dışarı tıklama denetimini ve masaüstündeki hizalamayı
      ayrıca kurmayı gerektirirdi.

      Genişlik telefonda ekranla sınırlanıyor: min(22rem, 100vw - 2rem). 375px
      bir ekranda 343px eder ve iki yanda 16px boşluk kalır — sayfanın geri
      kalanıyla aynı kenar boşluğu.
    -->
    <div
      v-if="acik"
      class="absolute right-4 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-lg sm:right-0"
    >
      <!--
        Boşluk ayrı bir öğe (flex-1), iki düğmeye de "ml-auto" vermek yerine.
        İkisinde birden ml-auto varken tarayıcı artan yeri İKİYE bölüyor ve
        "Tümünü okundu işaretle" başlıkla kapatma düğmesinin arasında
        ortalanmış gibi duruyordu.
      -->
      <div class="flex items-center gap-2 border-b border-ink-200 px-4 py-3">
        <p class="text-sm font-semibold text-ink-900">Bildirimler</p>
        <span class="flex-1" />
        <button
          v-if="okunmamis > 0"
          type="button"
          class="text-xs font-medium text-brand-600 hover:text-brand-700"
          @click="bildirimler.tumunuOkundu(props.kutu)"
        >
          Tümünü okundu işaretle
        </button>
        <!-- Telefonda kapatma düğmesi: tabakanın dışına basmak için yer az. -->
        <button
          type="button"
          class="rounded-lg p-1 text-ink-500 hover:bg-ink-100 sm:hidden"
          aria-label="Kapat"
          @click="acik = false"
        >
          <AppIcon name="kapat" :size="18" />
        </button>
      </div>

      <div class="max-h-[60vh] overflow-y-auto sm:max-h-96">
        <p v-if="kutu.loading && !kutu.items.length" class="px-4 py-8 text-center text-sm text-ink-500">
          Yükleniyor…
        </p>

        <p v-else-if="!kutu.items.length" class="px-4 py-8 text-center text-sm text-ink-500">
          Henüz bildiriminiz yok.<br />
          <span class="text-ink-400">Sipariş ve destek hareketleri burada görünecek.</span>
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="bildirim in kutu.items" :key="bildirim.id">
            <button
              type="button"
              class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink-50"
              :class="bildirim.readAt ? '' : 'bg-brand-50/60'"
              @click="tikla(bildirim)"
            >
              <span class="mt-0.5 shrink-0 text-ink-400">
                <AppIcon :name="simge(bildirim.kind)" :size="18" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-ink-900">{{ bildirim.title }}</span>
                <span v-if="bildirim.body" class="mt-0.5 block text-xs leading-relaxed text-ink-600">
                  {{ bildirim.body }}
                </span>
                <span class="mt-1 block text-xs text-ink-400" :title="formatDate(bildirim.createdAt)">
                  {{ gecenSure(bildirim.createdAt) }}
                </span>
              </span>

              <!-- Okunmamışı gösteren nokta: renk tek başına yeterli değil,
                   renk körü kullanıcı için ayrı bir işaret gerekiyor. -->
              <span
                v-if="!bildirim.readAt"
                class="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600"
                aria-label="Okunmadı"
              />
            </button>
          </li>
        </ul>
      </div>

      <!--
        Gerçek zamanlı bağlantı kurulamadıysa küçük bir not.
        Gizlemek yerine söylemek: kullanıcı bildirimin neden gecikmeli
        geldiğini bilmezse "çalışmıyor" sanır.
      -->
      <p v-if="bildirimler.akis === 'yoklama'" class="border-t border-ink-200 px-4 py-2 text-xs text-ink-400">
        Anlık bağlantı kurulamadı; bildirimler dakikada bir yenileniyor.
      </p>
    </div>
  </div>
</template>
