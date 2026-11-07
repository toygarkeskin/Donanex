<script setup>
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../../lib/api";
import { csvAyristir, basliklariEsle, fiyatNormalize, ORNEK_CSV } from "../../lib/csv";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import AlertBox from "../../components/AlertBox.vue";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const EN_FAZLA = 500;

const storeId = () => route.params.storeId;

const dosyaAdi = ref("");
const satirlar = ref([]); // { no, name, price, stock, sku, category, description, imageUrl, hata }
const okumaHatasi = ref("");
const gonderiliyor = ref(false);

const gecerliler = computed(() => satirlar.value.filter((s) => !s.hata));
const hataliSayisi = computed(() => satirlar.value.length - gecerliler.value.length);

/* ---------- okuma ---------- */

function metniIsle(metin) {
  okumaHatasi.value = "";
  satirlar.value = [];

  const tablo = csvAyristir(metin);
  if (tablo.length < 2) {
    okumaHatasi.value = "Dosyada başlık satırından sonra veri bulunamadı.";
    return;
  }

  const harita = basliklariEsle(tablo[0]);
  const alanlar = Object.values(harita);

  if (!alanlar.includes("name") || !alanlar.includes("price")) {
    okumaHatasi.value =
      "Başlık satırında en az 'ad' ve 'fiyat' sütunları olmalı. Örnek şablonu indirip onun üzerine yazabilirsiniz.";
    return;
  }

  const veri = tablo.slice(1);
  if (veri.length > EN_FAZLA) {
    okumaHatasi.value = `Tek seferde en fazla ${EN_FAZLA} ürün aktarılabilir; dosyada ${veri.length} satır var.`;
    return;
  }

  satirlar.value = veri.map((hucreler, sira) => {
    const kayit = { no: sira + 2 }; // 1. satır başlık olduğu için veri 2'den başlar
    for (const [sutun, alan] of Object.entries(harita)) {
      kayit[alan] = (hucreler[Number(sutun)] ?? "").trim();
    }
    kayit.price = fiyatNormalize(kayit.price);
    kayit.hata = satirDogrula(kayit);
    return kayit;
  });
}

/*
 * Tarayıcı tarafındaki doğrulama yalnızca kullanıcıya erken geri bildirim
 * içindir; asıl kural sunucudadır ve orası da aynı satırları reddeder.
 */
function satirDogrula(kayit) {
  if (!kayit.name) return "Ürün adı boş.";
  if (kayit.name.length > 160) return "Ürün adı çok uzun (en fazla 160).";
  if (!kayit.price) return "Fiyat boş.";
  if (!/^\d+(\.\d{1,2})?$/.test(kayit.price)) return `Fiyat okunamadı: "${kayit.price}"`;
  if (kayit.stock && !/^\d+$/.test(kayit.stock)) return `Stok tam sayı olmalı: "${kayit.stock}"`;
  if (kayit.imageUrl && !/^(\/images\/|https:\/\/)/.test(kayit.imageUrl)) {
    return "Görsel adresi '/images/...' ya da 'https://' ile başlamalı.";
  }
  return "";
}

function dosyaSecildi(olay) {
  const dosya = olay.target.files?.[0];
  if (!dosya) return;
  dosyaAdi.value = dosya.name;

  const okuyucu = new FileReader();
  okuyucu.onload = () => metniIsle(String(okuyucu.result ?? ""));
  okuyucu.onerror = () => {
    okumaHatasi.value = "Dosya okunamadı.";
  };
  okuyucu.readAsText(dosya, "utf-8");
}

function ornekIndir() {
  const blob = new Blob(["﻿" + ORNEK_CSV], { type: "text/csv;charset=utf-8" });
  const adres = URL.createObjectURL(blob);
  const bag = document.createElement("a");
  bag.href = adres;
  bag.download = "urun-sablonu.csv";
  bag.click();
  URL.revokeObjectURL(adres);
}

function temizle() {
  satirlar.value = [];
  dosyaAdi.value = "";
  okumaHatasi.value = "";
}

/* ---------- gönderme ---------- */

async function gonder() {
  if (gecerliler.value.length === 0) return;
  gonderiliyor.value = true;
  try {
    const yuk = gecerliler.value.map((s) => ({
      name: s.name,
      price: s.price,
      stock: s.stock || "0",
      sku: s.sku || undefined,
      description: s.description || undefined,
      imageUrl: s.imageUrl || undefined,
      // Boş bırakılabilir; yazılmışsa sunucu tanımadığı kategoride içe
      // aktarmayı durdurur, ürün sessizce kategorisiz kalmaz.
      category: s.category || undefined
    }));

    const sonuc = await api.post(`/stores/${storeId()}/products/bulk`, { products: yuk });
    toast.success(sonuc.message ?? `${sonuc.count} ürün içe aktarıldı.`);
    router.push({ name: "store-products", params: { storeId: storeId() } });
  } catch (hata) {
    toast.error(hata.message ?? "İçe aktarma başarısız oldu.");
  } finally {
    gonderiliyor.value = false;
  }
}
</script>

<template>
  <div>
    <PageHeader title="CSV ile ürün aktar" description="Bir dosyadan toplu ürün ekleyin.">
      <template #actions>
        <RouterLink :to="{ name: 'store-products', params: { storeId: route.params.storeId } }" class="btn-secondary">
          Ürünlere dön
        </RouterLink>
      </template>
    </PageHeader>

    <div class="card mb-6 p-5">
      <h2 class="mb-2 text-sm font-semibold text-ink-900">Dosya nasıl olmalı?</h2>
      <p class="text-sm text-ink-600">
        İlk satır başlık olmalı. Zorunlu sütunlar: <strong>ad</strong> ve <strong>fiyat</strong>.
        İsteğe bağlı: <strong>stok</strong>, <strong>stok kodu</strong>, <strong>kategori</strong>,
        <strong>aciklama</strong>, <strong>gorsel</strong>. Ayraç olarak noktalı virgül, virgül ya da
        sekme kullanılabilir; fiyatta hem <code>1299,90</code> hem <code>1299.90</code> yazımı okunur.
      </p>
      <p class="mt-2 text-sm text-ink-600">
        Kategori sütununa katalogdaki kategori adını yazın (örneğin <code>Klavye</code>). Boş
        bırakabilirsiniz; ama yazdığınız kategori katalogda yoksa içe aktarma durur ve hiçbir ürün
        eklenmez — ürünün sessizce kategorisiz kalıp filtrelerde kaybolmaması için.
      </p>
      <p class="mt-2 text-sm text-ink-600">
        Aktarılan ürünler <strong>taslak</strong> olarak eklenir — kontrol edip yayına almanız gerekir.
        Tek seferde en fazla {{ EN_FAZLA }} satır.
      </p>
      <button type="button" class="btn-secondary mt-4" @click="ornekIndir">Örnek şablonu indir</button>
    </div>

    <div class="card mb-6 p-5">
      <label for="csv" class="field-label">CSV dosyası</label>
      <input id="csv" type="file" accept=".csv,text/csv" class="field" @change="dosyaSecildi" />
      <p v-if="dosyaAdi" class="mt-2 text-xs text-ink-500">Seçilen dosya: {{ dosyaAdi }}</p>
    </div>

    <AlertBox v-if="okumaHatasi" tone="error" class="mb-6">{{ okumaHatasi }}</AlertBox>

    <template v-if="satirlar.length">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <p class="text-sm text-ink-600">
          <strong>{{ gecerliler.length }}</strong> satır aktarılmaya hazır.
          <span v-if="hataliSayisi > 0" class="text-red-600">
            {{ hataliSayisi }} satır atlanacak.
          </span>
        </p>
        <div class="ml-auto flex gap-2">
          <button type="button" class="btn-secondary" @click="temizle">Vazgeç</button>
          <button
            type="button"
            class="btn-primary"
            :disabled="gonderiliyor || gecerliler.length === 0"
            @click="gonder"
          >
            {{ gonderiliyor ? "Aktarılıyor…" : `${gecerliler.length} ürünü aktar` }}
          </button>
        </div>
      </div>

      <AlertBox v-if="hataliSayisi > 0" tone="warn" class="mb-4">
        Hatalı satırlar gönderilmez; diğerleri aktarılır. Düzeltip dosyayı yeniden seçebilirsiniz.
      </AlertBox>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Satır</th>
              <th>Ad</th>
              <th>Fiyat</th>
              <th>Stok</th>
              <th>Stok kodu</th>
              <th>Kategori</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="satir in satirlar" :key="satir.no" :class="satir.hata ? 'opacity-70' : ''">
              <td class="text-ink-500">{{ satir.no }}</td>
              <td class="font-medium text-ink-900">{{ satir.name || "—" }}</td>
              <td>{{ satir.price || "—" }}</td>
              <td>{{ satir.stock || "0" }}</td>
              <td class="text-ink-500">{{ satir.sku || "—" }}</td>
              <td class="text-ink-500">{{ satir.category || "—" }}</td>
              <td>
                <span v-if="satir.hata" class="text-xs font-medium text-red-600">{{ satir.hata }}</span>
                <span v-else class="text-xs font-medium text-green-600">Hazır</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
