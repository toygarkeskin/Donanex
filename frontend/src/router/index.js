import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

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
      { path: "sepet", name: "cart", component: () => import("../views/shop/CartView.vue") },
      { path: "odeme", name: "checkout", component: () => import("../views/shop/CheckoutView.vue") },
      { path: "odeme/:orderId", name: "payment", component: () => import("../views/shop/PaymentView.vue") },
      { path: "siparis-takip", name: "track", component: () => import("../views/shop/TrackOrderView.vue") },
      { path: "destek", name: "support", component: () => import("../views/shop/SupportView.vue") },

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

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 }
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

export default router;
