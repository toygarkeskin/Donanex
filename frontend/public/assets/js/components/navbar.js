import { api } from "../core/api.js";
import { html, setHtml } from "../core/dom.js";
import { cartCount } from "../core/cart.js";

/** Tüm sayfaların ortak üst menüsü: tek yerden yönetilir, kopya HTML yoktur. */
function menuTemplate(path) {
  const link = (href, label) =>
    html`<li class="nav-item"><a class="nav-link${path === href ? " active" : ""}" href="${href}">${label}</a></li>`;

  return html`
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand fw-bold" href="/anasayfa.html">Bilgisayar Bilgileri</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
          aria-controls="navbarNav" aria-expanded="false" aria-label="Menüyü aç/kapat">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
          <ul class="navbar-nav gap-3 align-items-lg-center">
            ${link("/hakkimizda.html", "Hakkımızda")}
            ${link("/urunler.html", "Ürünler")}
            ${link("/markalar.html", "Markalar")}
            ${link("/iletisim.html", "İletişim")}
            <li class="nav-item">
              <a class="nav-link" href="/favoriler.html" aria-label="Favoriler"><i class="bi bi-heart"></i></a>
            </li>
            <li class="nav-item">
              <a class="nav-link position-relative" href="/sepet.html" aria-label="Sepet">
                <i class="bi bi-cart3"></i>
                <span id="sepetSayaci" class="sepet-sayaci" hidden></span>
              </a>
            </li>
            <li class="nav-item" id="hesapMenu">
              <a class="nav-link" href="/hesap.html" aria-label="Hesap"><i class="bi bi-person-circle"></i></a>
            </li>
          </ul>
        </div>
      </div>
    </nav>`;
}

function updateCartBadge() {
  const badge = document.getElementById("sepetSayaci");
  if (!badge) return;
  const count = cartCount();
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = count === 0;
}

async function renderAccountMenu() {
  const menu = document.getElementById("hesapMenu");
  let customer = null;
  try {
    ({ customer } = await api("/api/customers/session"));
  } catch {
    return; // Oturum öğrenilemezse giriş bağlantısı kalır.
  }
  if (!customer) return;

  menu.classList.add("dropdown");
  setHtml(
    menu,
    html`
      <button type="button" class="hesap-buton" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Hesap menüsü">
        <i class="bi bi-person-circle fs-3 text-dark"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><span class="dropdown-item-text">${customer.name}</span></li>
        <li><a class="dropdown-item" href="/bilgilerim.html"><i class="bi bi-person-vcard me-2"></i>Bilgilerim</a></li>
        <li><a class="dropdown-item" href="/siparis-takip.html"><i class="bi bi-truck me-2"></i>Sipariş Takibi</a></li>
        <li><hr class="dropdown-divider"></li>
        <li>
          <button class="dropdown-item" type="button" id="hesapCikis">
            <i class="bi bi-box-arrow-right me-2"></i>Çıkış Yap
          </button>
        </li>
      </ul>`
  );

  document.getElementById("hesapCikis").addEventListener("click", async () => {
    try {
      await api("/api/customers/logout", { method: "POST" });
      window.location.href = "/anasayfa.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

const host = document.querySelector("[data-site-nav]");
if (host) {
  setHtml(host, menuTemplate(window.location.pathname));
  updateCartBadge();
  document.addEventListener("cart:changed", updateCartBadge);
  window.addEventListener("storage", updateCartBadge);
  renderAccountMenu();
}
