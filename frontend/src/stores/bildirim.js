import { defineStore } from "pinia";
import { api, getAccessToken, refreshAccessToken } from "../lib/api";

/*
 * Bildirimler.
 *
 * ÜÇ ayrı kutu var ve hepsi aynı mağazada duruyor:
 *   "mine"        → kişinin kendi bildirimleri (başlıktaki zil)
 *   "store:<id>"  → mağaza panelinin bildirimleri
 *   "admin"       → yönetim panelinin bildirimleri
 *
 * Tek mağaza, çünkü gerçek zamanlı bağlantı TEK: sunucu kişinin görebildiği
 * bütün kutuları aynı hattan gönderiyor ve gelen her satırın yanında hangi
 * kutuya ait olduğunu söyleyen bir anahtar var. Kutular ayrı mağazalarda
 * olsaydı gelen satırı doğru mağazaya dağıtacak dördüncü bir yere ihtiyaç
 * olurdu.
 */

/**
 * Sunucunun kullandığı alıcı anahtarını buradaki kutu adına çevirir.
 *
 * "user:" ön eki kullanıcı numarasına BAKILMADAN "mine" sayılıyor: sunucu
 * yalnızca bu bağlantının abone olduğu anahtarları gönderiyor ve bir
 * bağlantıda tek bir kullanıcı anahtarı var — kendisinin. Numarayı burada
 * tekrar karşılaştırmak, oturum değiştiğinde iki yerde güncellenmesi gereken
 * ikinci bir doğruluk kaynağı yaratırdı.
 */
function kutuAdi(anahtar) {
  if (anahtar.startsWith("user:")) return "mine";
  if (anahtar === "admin:") return "admin";
  if (anahtar.startsWith("store:")) return anahtar;
  return null;
}

/** Kutunun API yolu. */
function kutuYolu(kutu) {
  if (kutu === "mine") return "/me/notifications";
  if (kutu === "admin") return "/admin/notifications";
  return `/stores/${kutu.slice("store:".length)}/notifications`;
}

const bosKutu = () => ({ items: [], unread: 0, loaded: false, loading: false });

/*
 * Akış durumu ve yeniden bağlanma gecikmeleri.
 *
 * Bağlantı düştüğünde hemen ve sürekli denemek, sunucu gerçekten kapalıysa
 * saniyede bir istek demek. Gecikme katlanarak artıyor ve 60 saniyede
 * duruyor; bu arada yoklama çalıştığı için bildirimler yine görünüyor,
 * sadece anında değil.
 */
const YENIDEN_BAGLAN_MS = [5_000, 15_000, 30_000, 60_000];
const YOKLAMA_MS = 45_000;

/*
 * Bağlantı nesneleri mağaza DURUMUNDA tutulmuyor.
 *
 * AbortController, okuyucu ve zamanlayıcılar Vue'nun tepkiselliğine
 * sokulacak şeyler değil: Pinia bunları proxy'ye sarar, her iç alan
 * değişikliği izlenmeye çalışılır ve bazı tarayıcı nesneleri proxy altında
 * çalışmayı reddeder. Modül kapsamında durmaları yeterli — mağaza tekil.
 */
let durdurucu = null;
let yoklamaZamanlayici = null;
let yenidenBaglanZamanlayici = null;
let denemeSayisi = 0;
let kapatildi = true;

export const useBildirimStore = defineStore("bildirim", {
  state: () => ({
    kutular: {},
    /** "kapali" | "bagli" | "yoklama" — arayüzde küçük bir ipucu olarak gösterilir. */
    akis: "kapali"
  }),

  getters: {
    /** Kutuyu her zaman döndürür: arayüz "var mı yok mu" diye bakmak zorunda kalmasın. */
    kutu: (state) => (kutu) => state.kutular[kutu] ?? bosKutu(),
    okunmamis: (state) => (kutu) => state.kutular[kutu]?.unread ?? 0
  },

  actions: {
    kutuyuHazirla(kutu) {
      if (!this.kutular[kutu]) this.kutular[kutu] = bosKutu();
      return this.kutular[kutu];
    },

    /** Kutunun listesini sunucudan okur. */
    async yukle(kutu) {
      const hedef = this.kutuyuHazirla(kutu);
      if (hedef.loading) return;
      hedef.loading = true;
      try {
        const sayfa = await api.get(kutuYolu(kutu));
        hedef.items = sayfa.items ?? [];
        hedef.unread = sayfa.unread ?? 0;
        hedef.loaded = true;
      } catch {
        // Yetkisi yoksa ya da ağ koptuysa kutu boş kalır; zil gürültü yapmaz.
        hedef.loaded = true;
      } finally {
        hedef.loading = false;
      }
    },

    /**
     * Yalnızca okunmamış sayısını okur.
     *
     * Yoklama bunu kullanıyor: on beş satır yerine tek sayı taşıyor. Sayı
     * değiştiyse liste de tazeleniyor, yani kullanıcı zili açtığında güncel
     * içeriği görüyor.
     */
    async sayacYukle(kutu) {
      const hedef = this.kutuyuHazirla(kutu);
      try {
        const { unread } = await api.get(`${kutuYolu(kutu)}/unread-count`);
        if (unread !== hedef.unread) {
          hedef.unread = unread;
          if (hedef.loaded) await this.yukle(kutu);
        }
      } catch {
        /* yoklama hatası sessiz geçer */
      }
    },

    /** Akıştan gelen bildirimi listenin başına koyar. */
    ekle(kutu, bildirim) {
      const hedef = this.kutuyuHazirla(kutu);
      // Aynı bildirim iki kez gelirse (yeniden bağlanma anında) ikilenmesin.
      if (hedef.items.some((item) => item.id === bildirim.id)) return;
      hedef.items = [bildirim, ...hedef.items].slice(0, 30);
      if (!bildirim.readAt) hedef.unread += 1;
    },

    async okundu(kutu, id) {
      const hedef = this.kutuyuHazirla(kutu);
      const bildirim = hedef.items.find((item) => item.id === id);
      if (!bildirim || bildirim.readAt) return;
      // Arayüz beklemiyor: işaret hemen konuyor, istek arkada gidiyor.
      bildirim.readAt = new Date().toISOString();
      hedef.unread = Math.max(0, hedef.unread - 1);
      await api.post(`${kutuYolu(kutu)}/${id}/read`).catch(() => this.yukle(kutu));
    },

    async tumunuOkundu(kutu) {
      const hedef = this.kutuyuHazirla(kutu);
      if (!hedef.unread) return;
      const simdi = new Date().toISOString();
      hedef.items = hedef.items.map((item) => (item.readAt ? item : { ...item, readAt: simdi }));
      hedef.unread = 0;
      await api.post(`${kutuYolu(kutu)}/read-all`).catch(() => this.yukle(kutu));
    },

    /* ---------------- gerçek zamanlı akış ---------------- */

    /** Giriş yapıldığında çağrılır: kişisel kutuyu yükler ve akışı kurar. */
    async baslat() {
      if (!kapatildi) return;
      kapatildi = false;
      denemeSayisi = 0;
      await this.yukle("mine");
      this.akisiBagla();
    },

    /** Çıkışta çağrılır: bağlantı kapanır, kutular boşalır. */
    durdur() {
      kapatildi = true;
      durdurucu?.abort();
      durdurucu = null;
      clearInterval(yoklamaZamanlayici);
      clearTimeout(yenidenBaglanZamanlayici);
      yoklamaZamanlayici = null;
      yenidenBaglanZamanlayici = null;
      this.kutular = {};
      this.akis = "kapali";
    },

    /**
     * Akışı kurar.
     *
     * EventSource KULLANILMIYOR, fetch kullanılıyor. Sebep: EventSource
     * başlık eklemeye izin vermiyor, bu uygulamada erişim jetonu ise
     * Authorization başlığında taşınıyor (bellekte durur, çereze yazılmaz).
     * Jetonu adrese koymak tek alternatifti; o da sunucu günlüklerine ve
     * Referer başlığına jeton düşürmek olurdu.
     *
     * Karşılığında yeniden bağlanmayı kendimiz yazıyoruz — EventSource bunu
     * hazır veriyordu.
     */
    async akisiBagla() {
      if (kapatildi) return;
      durdurucu?.abort();
      durdurucu = new AbortController();

      try {
        const yanit = await this.akisIstegi(durdurucu.signal);
        if (!yanit.ok || !yanit.body) throw new Error(`akış kurulamadı: ${yanit.status}`);

        // Bağlantı kuruldu: yoklamayı durdur, kaçırılmış olabilecekleri tazele.
        clearInterval(yoklamaZamanlayici);
        yoklamaZamanlayici = null;
        denemeSayisi = 0;
        this.akis = "bagli";
        await this.acikKutulariTazele();

        await this.akisiOku(yanit.body);
        // Akış kendiliğinden bitti (sunucu kapandı ya da ağ düştü).
        if (!kapatildi) this.yenidenBaglan();
      } catch (error) {
        if (durdurucu?.signal.aborted || kapatildi) return;
        void error;
        this.yenidenBaglan();
      }
    },

    /** Jetonla akış isteği; jeton süresi dolmuşsa bir kez yeniler. */
    async akisIstegi(signal) {
      const istek = (token) =>
        fetch("/api/me/notifications/stream", {
          credentials: "same-origin",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal
        });

      let yanit = await istek(getAccessToken());
      if (yanit.status === 401) {
        const yeni = await refreshAccessToken();
        if (yeni) yanit = await istek(yeni);
      }
      return yanit;
    },

    /**
     * Akışı satır satır okur.
     *
     * Sunucu olayları olay akışı (SSE) biçiminde yazıyor: boş satırla ayrılmış
     * bloklar. Tampon tutmak ŞART — bir blok ağ paketlerine bölünmüş gelebilir,
     * her parçayı tek başına ayrıştırmaya çalışmak bozuk JSON demektir.
     */
    async akisiOku(body) {
      const okuyucu = body.pipeThrough(new TextDecoderStream()).getReader();
      let tampon = "";

      for (;;) {
        const { value, done } = await okuyucu.read();
        if (done) return;
        tampon += value;

        let kesme = tampon.indexOf("\n\n");
        while (kesme !== -1) {
          this.blokIsle(tampon.slice(0, kesme));
          tampon = tampon.slice(kesme + 2);
          kesme = tampon.indexOf("\n\n");
        }
      }
    },

    blokIsle(blok) {
      // ":" ile başlayan satırlar yorumdur (nabız); veri taşımazlar.
      const satirlar = blok.split("\n").filter((satir) => satir.startsWith("data:"));
      if (!satirlar.length) return;

      try {
        const { key, item } = JSON.parse(satirlar.map((satir) => satir.slice(5).trim()).join("\n"));
        const kutu = kutuAdi(String(key ?? ""));
        if (kutu && item) this.ekle(kutu, item);
      } catch {
        /* bozuk blok akışı durdurmaz */
      }
    },

    /** Bağlantı kurulamadı ya da düştü: yoklamaya geç, sonra yeniden dene. */
    yenidenBaglan() {
      if (kapatildi) return;
      this.akis = "yoklama";
      this.yoklamayiBaslat();

      const gecikme = YENIDEN_BAGLAN_MS[Math.min(denemeSayisi, YENIDEN_BAGLAN_MS.length - 1)];
      denemeSayisi += 1;
      clearTimeout(yenidenBaglanZamanlayici);
      yenidenBaglanZamanlayici = setTimeout(() => this.akisiBagla(), gecikme);
    },

    yoklamayiBaslat() {
      if (yoklamaZamanlayici) return;
      yoklamaZamanlayici = setInterval(() => this.acikKutulariTazele(true), YOKLAMA_MS);
    },

    /** Açılmış bütün kutuları tazeler (yalnızca sayaç ya da tam liste). */
    async acikKutulariTazele(yalnizcaSayac = false) {
      const kutular = Object.keys(this.kutular);
      for (const kutu of kutular) {
        await (yalnizcaSayac ? this.sayacYukle(kutu) : this.yukle(kutu));
      }
    },

    /**
     * Panel kutusunu kullanıma açar.
     *
     * Panel açıldığında çağrılıyor: o ana kadar o kutu hiç istenmemiş
     * olabilir. Akış zaten kurulu olduğu için yeni bir bağlantıya gerek yok,
     * yalnızca ilk içerik okunuyor.
     */
    async kutuyuAc(kutu) {
      const hedef = this.kutuyuHazirla(kutu);
      if (!hedef.loaded) await this.yukle(kutu);
    }
  }
});
