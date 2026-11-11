import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { sayfayiTanimla } from "../lib/sayfaBilgisi";
import { BILGI_ROTALARI, BILGI_SAYFALARI } from "../content/bilgiSayfalari";

/**
 * Rotalar. Panel ekranları tembel yüklenir (lazy): vitrine gelen ziyaretçi
 * yönetim ekranlarının kodunu indirmez.
 *
 * Buradaki korumalar KULLANIM KOLAYLIĞI içindir, güvenlik değildir —
 * asıl yetki denetimi her istekte sunucuda yapılır.
 */
const routes = [
  {
    path: "/",
    component: () => import("../layouts/ShopLayout.vue"),
    children: [
      { path: "", name: "home", component: () => import("../views/shop/HomeView.vue") },
      { path: "urunler", name: "products", component: () => import("../views/shop/ProductsView.vue") },
      {
        path: "urunler/:storeSlug/:productSlug",
        name: "product",
        component: () => import("../views/shop/ProductView.vue")
      },
      { path: "magazalar", name: "stores", component: () => import("../views/shop/StoresView.vue") },
      { path: "magazalar/:slug", name: "store", component: () => import("../views/shop/StoreView.vue") },
      { path: "markalar/:slug", name: "brand", component: () => import("../views/shop/BrandView.vue") },
      { path: "sepet", name: "cart", component: () => import("../views/shop/CartView.vue") },
      { path: "odeme", name: "checkout", component: () => import("../views/shop/CheckoutView.vue") },
      { path: "odeme/:orderId", name: "payment", component: () => import("../views/shop/PaymentView.vue") },
      { path: "siparis-takip", name: "track", component: () => import("../views/shop/TrackOrderView.vue") },
      { path: "destek", name: "support", component: () => import("../views/shop/SupportView.vue") },

      /*
       * Bilgilendirme sayfaları (hakkımızda, KVKK, SSS ...).
       *
       * Dokuz rota tek tek YAZILMIYOR, içerik listesinden üretiliyor:
       * başlık, adres ve metin tek yerde durunca biri değişince
       * diğerleri geride kalmıyor. Hepsi aynı görünümü kullanıyor,
       * hangi sayfa olduğu "anahtar" prop'uyla gidiyor.
       */
      ...BILGI_ROTALARI.map(({ yol, ad, anahtar }) => ({
        path: yol,
        name: ad,
        component: () => import("../views/shop/BilgiView.vue"),
        props: { anahtar }
      })),

      {
        path: "hesabim",
        component: () => import("../views/account/AccountLayout.vue"),
        meta: { requiresAuth: true },
        children: [
          { path: "", redirect: { name: "account-orders" } },
          { path: "siparisler", name: "account-orders", component: () => import("../views/account/OrdersView.vue") },
          {
            path: "siparisler/:orderId",
            name: "account-order",
            component: () => import("../views/account/OrderDetailView.vue")
          },
          { path: "adresler", name: "account-addresses", component: () => import("../views/account/AddressesView.vue") },
          { path: "profil", name: "account-profile", component: () => import("../views/account/ProfileView.vue") },
          { path: "talepler", name: "account-tickets", component: () => import("../views/account/TicketsView.vue") },
          {
            path: "magaza-basvurusu",
            name: "account-store-application",
            component: () => import("../views/account/StoreApplicationView.vue")
          }
        ]
      }
    ]
  },

  {
    path: "/",
    component: () => import("../layouts/PlainLayout.vue"),
    children: [
      { path: "giris", name: "sign-in", component: () => import("../views/auth/SignInView.vue") },
      { path: "kayit", name: "register", component: () => import("../views/auth/RegisterView.vue") },
      { path: "auth/callback", name: "auth-callback", component: () => import("../views/auth/CallbackView.vue") },
      {
        path: "parola-unuttum",
        name: "forgot-password",
        component: () => import("../views/auth/ForgotPasswordView.vue")
      },
      {
        path: "parola-sifirla",
        name: "reset-password",
        component: () => import("../views/auth/ResetPasswordView.vue")
      },
      { path: "eposta-dogrula", name: "verify-email", component: () => import("../views/auth/VerifyEmailView.vue") }
    ]
  },

  {
    path: "/magaza",
    component: () => import("../layouts/PanelLayout.vue"),
    meta: { requiresAuth: true, panel: "store" },
    children: [
      { path: "", name: "store-panel", component: () => import("../views/store/StoreRedirect.vue") },
      { path: ":storeId", name: "store-dashboard", component: () => import("../views/store/DashboardView.vue") },
      { path: ":storeId/urunler", name: "store-products", component: () => import("../views/store/ProductsView.vue") },
      {
        path: ":storeId/urunler/yeni",
        name: "store-product-new",
        component: () => import("../views/store/ProductFormView.vue")
      },
      {
        // ":productId" kuralından ÖNCE gelmeli; yoksa "ice-aktar" bir ürün
        // numarası sanılır ve düzenleme ekranı açılmaya çalışılır.
        path: ":storeId/urunler/ice-aktar",
        name: "store-product-import",
        component: () => import("../views/store/ProductImportView.vue")
      },
      {
        path: ":storeId/urunler/:productId",
        name: "store-product-edit",
        component: () => import("../views/store/ProductFormView.vue")
      },
      { path: ":storeId/siparisler", name: "store-orders", component: () => import("../views/store/OrdersView.vue") },
      {
        path: ":storeId/siparisler/:packageId",
        name: "store-order",
        component: () => import("../views/store/OrderDetailView.vue")
      },
      { path: ":storeId/calisanlar", name: "store-members", component: () => import("../views/store/MembersView.vue") },
      { path: ":storeId/talepler", name: "store-tickets", component: () => import("../views/store/TicketsView.vue") },
      { path: ":storeId/ayarlar", name: "store-settings", component: () => import("../views/store/SettingsView.vue") }
    ]
  },

  {
    path: "/yonetim",
    component: () => import("../layouts/PanelLayout.vue"),
    meta: { requiresAuth: true, panel: "admin", adminOnly: true },
    children: [
      { path: "", name: "admin-dashboard", component: () => import("../views/admin/DashboardView.vue") },
      { path: "magazalar", name: "admin-stores", component: () => import("../views/admin/StoresView.vue") },
      { path: "kullanicilar", name: "admin-users", component: () => import("../views/admin/UsersView.vue") },
      { path: "siparisler", name: "admin-orders", component: () => import("../views/admin/OrdersView.vue") },
      {
        path: "siparisler/:orderId",
        name: "admin-order",
        component: () => import("../views/admin/OrderDetailView.vue")
      },
      { path: "talepler", name: "admin-tickets", component: () => import("../views/admin/TicketsView.vue") }
    ]
  },

  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("../views/NotFoundView.vue") }
];

/**
 * Rota adı -> sekme başlığı.
 *
 * Tek bir haritada duruyor: kırk rota tanımına tek tek meta eklemek hem
 * dosyayı şişirir hem başlıkları görmek için her satıra bakmayı gerektirir.
 * Boş metin "yalnızca site adı" demektir (ana sayfa).
 *
 * Ürün ve mağaza sayfaları burada GENEL bir başlık alır; veri geldiğinde
 * kendi görünümleri başlığı ürünün/mağazanın adıyla değiştirir.
 */
const SAYFA_BASLIKLARI = {
  home: "",
  products: "Ürünler",
  product: "Ürün",
  stores: "Mağazalar",
  store: "Mağaza",
  brand: "Marka",
  cart: "Sepetim",
  checkout: "Siparişi tamamla",
  payment: "Ödeme",
  track: "Sipariş takibi",
  support: "Destek",

  // Bilgilendirme sayfalarının başlık ve açıklamaları da içerikten geliyor.
  ...Object.fromEntries(BILGI_ROTALARI.map(({ ad, anahtar }) => [ad, BILGI_SAYFALARI[anahtar].baslik])),

  "account-orders": "Siparişlerim",
  "account-order": "Sipariş detayı",
  "account-addresses": "Adreslerim",
  "account-profile": "Hesap bilgilerim",
  "account-tickets": "Destek taleplerim",
  "account-store-application": "Mağaza başvurusu",

  "sign-in": "Giriş yap",
  register: "Kayıt ol",
  "forgot-password": "Parolamı unuttum",
  "reset-password": "Parola sıfırlama",
  "verify-email": "E-posta doğrulama",
  "auth-callback": "Yönlendiriliyor",

  "store-panel": "Mağaza paneli",
  "store-dashboard": "Mağaza paneli",
  "store-products": "Ürünlerim",
  "store-product-new": "Yeni ürün",
  "store-product-edit": "Ürünü düzenle",
  "store-product-import": "CSV ile ürün aktar",
  "store-orders": "Mağaza siparişleri",
  "store-order": "Sipariş detayı",
  "store-members": "Çalışanlar",
  "store-tickets": "Destek talepleri",
  "store-settings": "Mağaza ayarları",

  "admin-dashboard": "Yönetim paneli",
  "admin-stores": "Mağazalar — yönetim",
  "admin-users": "Kullanıcılar",
  "admin-orders": "Siparişler — yönetim",
  "admin-order": "Sipariş detayı",
  "admin-tickets": "Destek talepleri",

  "not-found": "Sayfa bulunamadı"
};

/**
 * Arama sonuçlarında görünmesi anlamlı olan HERKESE AÇIK sayfaların
 * açıklamaları. Panel ve hesap sayfaları buraya girmez: onlar giriş
 * gerektirir, aramada çıkmazlar.
 */
const SAYFA_ACIKLAMALARI = {
  products: "Onlarca mağazanın teknoloji ürünleri tek listede. Kategori, mağaza ve fiyata göre süzün.",
  stores: "Donanex'teki satıcı mağazaları. Her mağazanın ürünlerini ve ilanlarını görün.",
  track: "Sipariş numaranız ve takip kodunuzla siparişinizin durumunu üye olmadan sorgulayın.",
  support: "Sorunuz mu var? Üye olmadan destek talebi oluşturun, yanıtı e-postayla alın.",
  cart: "Sepetinizdeki ürünler. Farklı mağazalardan aldıklarınız tek ödemeyle tamamlanır.",

  ...Object.fromEntries(BILGI_ROTALARI.map(({ ad, anahtar }) => [ad, BILGI_SAYFALARI[anahtar].aciklama]))
};

export const router = createRouter({
  history: createWebHistory(),
  routes,
  /*
   * Sayfa değişiminde kaydırma.
   *
   * "behavior: instant" ŞART. style.css'te `html { scroll-behavior: smooth }`
   * var (sayfa içi bağlantılar yumuşak kaysın diye) ve bu ayar buradaki
   * "başa dön"ü de animasyona çeviriyordu. Animasyon sürerken yeni sayfanın
   * verisi gelip yükseklik değişince tarayıcı animasyonu kesiyor ve sayfa
   * ortada kalıyordu: ürüne tıklayınca sayfanın bazen ortadan açılmasının
   * sebebi buydu. "Bazen", çünkü verinin animasyondan önce mi sonra mı
   * geldiğine bağlıydı.
   *
   * Geri/ileri tuşunda kayıtlı konuma dönülüyor, orada da animasyon yok:
   * kullanıcı bıraktığı yeri görmek istiyor, oraya kayışı izlemek değil.
   */
  scrollBehavior: (to, from, saved) => {
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    if (saved) return { ...saved, behavior: "instant" };
    return { top: 0, behavior: "instant" };
  }
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  // İlk gezinmede sessiz giriş denenir; yenileme çerezi varsa oturum geri gelir.
  if (!auth.ready) await auth.restore();

  if (to.meta.requiresAuth && !auth.isSignedIn) {
    return { name: "sign-in", query: { donus: to.fullPath } };
  }
  if (to.meta.adminOnly && !auth.isSystemAdmin) {
    return { name: "home" };
  }
  if (to.meta.panel === "store" && !auth.isSystemAdmin && !auth.hasStorePanel) {
    return { name: "account-store-application" };
  }
  return true;
});

/*
 * Başlık ve açıklama gezinme TAMAMLANINCA yazılır.
 *
 * beforeEach'te yazılsaydı, koruma gezinmeyi iptal ettiğinde (giriş gerekiyor,
 * yetki yok) kullanıcı hâlâ eski sayfadayken başlık gitmediği sayfanınki
 * olurdu.
 *
 * Dinamik sayfalar bunun üzerine kendi başlığını yazar: ürün ve mağaza
 * görünümleri veri gelince ürünün/mağazanın adını koyar. Burada önce genel
 * başlık görünür, veri gelince adıyla değişir — boş bir sekme başlığından iyi.
 */
router.afterEach((to) => {
  sayfayiTanimla(SAYFA_BASLIKLARI[to.name], SAYFA_ACIKLAMALARI[to.name]);
});

export default router;
