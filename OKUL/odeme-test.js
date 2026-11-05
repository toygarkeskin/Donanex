
const params = new URLSearchParams(window.location.search);
const orderId = params.get("orderId");

// Sayfa elemanları
const siparisNo = document.getElementById("siparisNo");
const tutar = document.getElementById("tutar");
const mesaj = document.getElementById("mesaj");
const onayla = document.getElementById("onayla");
const basarisiz = document.getElementById("basarisiz");

// Takip kodu elemanları
const takipKoduAlani = document.getElementById("gosterilenTakipKodu");
const takipKoduKutusu = document.getElementById("takipKoduBilgisi");
const kopyalaButonu = document.getElementById("takipKoduKopyala");
const takipSiparisNo = document.getElementById("takipSiparisNo");

// Sipariş numarasını göster
if (siparisNo) {
    siparisNo.textContent = orderId || "Geçersiz";
}

// Butonları başlangıçta devre dışı bırak
if (onayla) onayla.disabled = true;
if (basarisiz) basarisiz.disabled = true;

// Takip kodunu göster
const kayitliTakipKodu = sessionStorage.getItem("siparisTakipKodu");

if (takipSiparisNo) {
    takipSiparisNo.textContent =
        sessionStorage.getItem("siparisTakipNo") || orderId || "Bilinmiyor";
}

if (takipKoduAlani && takipKoduKutusu && kayitliTakipKodu) {
    takipKoduAlani.value = kayitliTakipKodu;
    takipKoduKutusu.classList.remove("d-none");
}

// Takip kodunu kopyala
if (kopyalaButonu && takipKoduAlani) {
    kopyalaButonu.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(takipKoduAlani.value);
            kopyalaButonu.textContent = "Kopyalandı!";
        } catch (hata) {
            takipKoduAlani.select();
            kopyalaButonu.textContent =
                "Kodu seçtim; Ctrl+C ile kopyala";
        }
    });
}

// Siparişi sunucudan yükle
async function siparisiYukle() {
    if (!orderId || !/^\d+$/.test(orderId)) {
        if (mesaj) mesaj.textContent = "Geçersiz sipariş numarası.";
        return;
    }

    try {
        const cevap = await fetch(
            "/api/orders/" + encodeURIComponent(orderId)
        );

        const veri = await cevap.json();

        if (!cevap.ok || !veri.success) {
            throw new Error(veri.message || "Sipariş bulunamadı.");
        }

        if (tutar) {
            tutar.textContent = Number(veri.order.total).toLocaleString(
                "tr-TR",
                {
                    style: "currency",
                    currency: "TRY"
                }
            );
        }

        if (veri.order.status !== "Ödeme bekleniyor") {
            if (mesaj) {
                mesaj.textContent = "Bu sipariş daha önce işlenmiş.";
            }
            return;
        }

        if (onayla) onayla.disabled = false;
        if (basarisiz) basarisiz.disabled = false;

    } catch (hata) {
        if (mesaj) mesaj.textContent = hata.message;
    }
}

// Test ödeme sonucunu sunucuya gönder
async function testSonuc(basarili) {
    if (!orderId || !/^\d+$/.test(orderId)) {
        if (mesaj) mesaj.textContent = "Geçersiz sipariş numarası.";
        return;
    }

    if (onayla) onayla.disabled = true;
    if (basarisiz) basarisiz.disabled = true;

    if (mesaj) mesaj.textContent = "Test sonucu işleniyor...";

    try {
        const cevap = await fetch(
            "/api/orders/" + encodeURIComponent(orderId) + "/test-payment",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    successful: basarili
                })
            }
        );

        const veri = await cevap.json();

        if (!cevap.ok || !veri.success) {
            throw new Error(veri.message || "İşlem tamamlanamadı.");
        }

        if (basarili) {
            localStorage.removeItem("sepet");

            if (mesaj) {
                mesaj.textContent =
                    "TEST BAŞARILI! Sipariş numaranız: " +
                    orderId +
                    ". Gerçek ödeme alınmadı.";
            }
        } else {
            if (mesaj) {
                mesaj.textContent =
                    "Test ödemesi başarısız olarak işaretlendi. " +
                    "Gerçek ödeme alınmadı.";
            }
        }

    } catch (hata) {
        if (mesaj) mesaj.textContent = hata.message;

        if (onayla) onayla.disabled = false;
        if (basarisiz) basarisiz.disabled = false;
    }
}

// Butonlara tıklama olayları
if (onayla) {
    onayla.addEventListener("click", () => {
        testSonuc(true);
    });
}

if (basarisiz) {
    basarisiz.addEventListener("click", () => {
        testSonuc(false);
    });
}

// Sayfa açılınca siparişi yükle
siparisiYukle();
