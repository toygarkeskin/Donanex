/*
 * Temayı uygulama açılmadan ÖNCE uygular.
 *
 * Neden ayrı dosya: katı CSP (script-src 'self') satır içi script'e izin
 * vermiyor. Neden <head> içinde: Vue yüklenene kadar beklenirse sayfa önce
 * açık temada boyanır, sonra koyuya atlar ("flash of wrong theme").
 */
(function () {
  var kok = document.documentElement;
  var koyu = false;

  try {
    var kayitli = localStorage.getItem("tema");
    if (kayitli === "koyu") koyu = true;
    else if (kayitli === "acik") koyu = false;
    else koyu = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (e) {
    // Gizli pencerede localStorage erişimi hata verebilir: açık temada kal.
    koyu = false;
  }

  kok.setAttribute("data-theme", koyu ? "dark" : "light");
  // Tarayıcının kendi bileşenleri de (kaydırma çubuğu, form alanları) uysun.
  kok.style.colorScheme = koyu ? "dark" : "light";
})();
