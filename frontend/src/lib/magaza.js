import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

/**
 * Panel adresindeki mağaza.
 *
 * Adres çubuğunda mağazanın KISA ADI duruyor ("/magaza/teknoloji-deposu"),
 * eskiden olduğu gibi UUID değil. API ise mağazayı hâlâ kimliğiyle tanıyor;
 * çeviriyi burası yapıyor.
 *
 * Çeviri için ayrı bir istek atılmıyor: kişinin mağazaları zaten /api/me
 * yanıtıyla geliyor ve kısa adı da içinde. Yani adres çözümü bedava.
 *
 * Adres UUID taşıyorsa (eski bağlantılar, e-postalar, bildirimler) yine
 * çalışıyor — yönlendirici onu kısa ada çevirip adresi düzeltiyor, bkz.
 * router/index.js.
 *
 * SINIR: kişinin üyesi OLMADIĞI bir mağazanın kısa adı çözülemez, çünkü o
 * mağaza /api/me listesinde yok. Böyle bir adreste ham parametre kimlik
 * sayılıp API'ye gönderiliyor; yetkisi yoksa zaten 403 dönüyor. Pratikte
 * bu yola yalnızca adresi elle yazarak gelinir, menüde karşılığı yok.
 */
export function useMagaza() {
  const route = useRoute();
  const auth = useAuthStore();

  const anahtar = computed(() => String(route.params.storeSlug ?? ""));

  const magaza = computed(
    () =>
      auth.stores.find((store) => store.slug === anahtar.value) ??
      auth.stores.find((store) => store.id === anahtar.value) ??
      null
  );

  return {
    magaza,
    /** API çağrıları için: çözülemezse ham parametre (eski UUID adresleri). */
    id: computed(() => magaza.value?.id ?? anahtar.value),
    /** Bağlantılar için: adres çubuğunda görünen kısa ad. */
    slug: computed(() => magaza.value?.slug ?? anahtar.value),
    /** Bağlantılarda tek tek yazmamak için hazır parametre nesnesi. */
    params: computed(() => ({ storeSlug: magaza.value?.slug ?? anahtar.value }))
  };
}
