import { byId } from "../../core/dom.js";
import { adminApi, onUnauthorized, setMessage } from "./common.js";
import { loadProducts } from "./products.js";
import { loadOrders } from "./orders.js";
import { loadSupportRequests } from "./support.js";

export async function loadStats() {
  const { stats } = await adminApi("/api/admin/stats");
  byId("statProducts").textContent = stats.product_count;
  byId("statLowStock").textContent = stats.low_stock_count;
  byId("statOrders").textContent = stats.order_count;
  byId("statPending").textContent = stats.pending_count;
  byId("statSuccess").textContent = stats.test_success_count;
  byId("statFailed").textContent = stats.test_failed_count;
  byId("statSupport").textContent = stats.new_support_count;
}

document.addEventListener("admin:stats-changed", () => loadStats().catch(() => {}));

function showLogin(message = "") {
  byId("loginView").hidden = false;
  byId("dashboardView").hidden = true;
  setMessage("loginMessage", message, message ? "error" : "");
}

async function showDashboard() {
  byId("loginView").hidden = true;
  byId("dashboardView").hidden = false;
  await Promise.all([loadStats(), loadProducts(), loadOrders(), loadSupportRequests()]);
}

onUnauthorized(() => showLogin("Oturum süren dolmuş olabilir. Yeniden giriş yap."));

byId("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("loginMessage", "Giriş kontrol ediliyor…");
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await adminApi("/api/admin/login", {
      method: "POST",
      body: { username: byId("username").value.trim(), password: byId("password").value }
    });
    byId("password").value = "";
    setMessage("loginMessage", "");
    await showDashboard();
  } catch (error) {
    setMessage("loginMessage", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

byId("logoutBtn").addEventListener("click", async () => {
  await adminApi("/api/admin/logout", { method: "POST" }).catch(() => {});
  showLogin("Çıkış yapıldı.");
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
    for (const id of ["productsSection", "ordersSection", "supportSection"]) {
      byId(id).hidden = button.dataset.tab !== id;
    }
  });
});

(async function boot() {
  try {
    const { authenticated } = await adminApi("/api/admin/session");
    if (authenticated) await showDashboard();
    else showLogin();
  } catch {
    showLogin();
  }
})();
