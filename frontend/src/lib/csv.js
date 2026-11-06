/*
 * Küçük bir CSV okuyucu.
 *
 * Neden hazır bir kütüphane değil: ihtiyaç tek bir ekranda, tek bir biçimde.
 * Tırnaklı alan, alan içinde ayraç ve çift tırnak kaçışı ("") desteklenir;
 * bunlar Excel'in ürettiği dosyalar için yeterlidir.
 *
 * Ayraç otomatik bulunur: Türkçe Excel ";" yazar, çoğu araç "," yazar.
 */

const AYRAC_ADAYLARI = [";", ",", "\t"];

/** İlk satıra bakarak en çok geçen ayracı seçer. */
function ayracBul(ilkSatir) {
  let secilen = ",";
  let enCok = 0;
  for (const aday of AYRAC_ADAYLARI) {
    const sayi = ilkSatir.split(aday).length - 1;
    if (sayi > enCok) {
      enCok = sayi;
      secilen = aday;
    }
  }
  return secilen;
}

/** Metni satır/alan dizisine çevirir. */
export function csvAyristir(metin) {
  // BOM, Excel'in UTF-8 dosyalarının başına koyduğu görünmez karakter.
  const temiz = metin.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const ayrac = ayracBul(temiz.split("\n")[0] ?? "");

  const satirlar = [];
  let satir = [];
  let alan = "";
  let tirnakta = false;

  for (let i = 0; i < temiz.length; i++) {
    const karakter = temiz[i];

    if (tirnakta) {
      if (karakter === '"') {
        if (temiz[i + 1] === '"') {
          alan += '"';
          i++;
        } else {
          tirnakta = false;
        }
      } else {
        alan += karakter;
      }
      continue;
    }

    if (karakter === '"') tirnakta = true;
    else if (karakter === ayrac) {
      satir.push(alan);
      alan = "";
    } else if (karakter === "\n") {
      satir.push(alan);
      satirlar.push(satir);
      satir = [];
      alan = "";
    } else {
      alan += karakter;
    }
  }

  satir.push(alan);
  satirlar.push(satir);

  // Tamamen boş satırları at (dosya sonundaki yeni satır gibi).
  return satirlar.filter((s) => s.some((hucre) => hucre.trim() !== ""));
}

/* Başlık adları: Türkçe ve İngilizce yazımların hepsi kabul edilir. */
const BASLIK_ESLESME = {
  name: ["ad", "adi", "adı", "urun", "ürün", "urun adi", "ürün adı", "name", "product", "title"],
  price: ["fiyat", "price", "tutar"],
  stock: ["stok", "stok adedi", "adet", "stock", "quantity", "qty"],
  sku: ["stok kodu", "sku", "kod", "barkod", "code"],
  description: ["aciklama", "açıklama", "description", "detay"],
  imageUrl: ["gorsel", "görsel", "gorsel adresi", "görsel adresi", "resim", "imageurl", "image", "image url"]
};

const sadelestir = (metin) =>
  metin
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

/** Başlık satırını alan adlarına eşler: { 0: "name", 2: "price", ... } */
export function basliklariEsle(baslikSatiri) {
  const harita = {};
  baslikSatiri.forEach((baslik, sutun) => {
    const sade = sadelestir(baslik);
    for (const [alan, adlar] of Object.entries(BASLIK_ESLESME)) {
      if (adlar.includes(sade)) {
        // Aynı alan iki kez yazılmışsa ilk sütun kazanır.
        if (!Object.values(harita).includes(alan)) harita[sutun] = alan;
        break;
      }
    }
  });
  return harita;
}

/**
 * "1.299,90" → "1299.90", "1299,9" → "1299.9", "1299.90" → "1299.90"
 *
 * Türkçe Excel binlik ayracı olarak nokta, ondalık olarak virgül yazar.
 * Sunucu yalnızca sade ondalık bekler; dönüşüm burada yapılır ki kullanıcı
 * önizlemede ne göndereceğini görsün.
 */
export function fiyatNormalize(ham) {
  const metin = String(ham ?? "").trim().replace(/\s|₺|TL/gi, "");
  if (metin === "") return "";

  const sonVirgul = metin.lastIndexOf(",");
  const sonNokta = metin.lastIndexOf(".");

  if (sonVirgul > sonNokta) {
    // Virgül ondalık: noktalar binlik ayracıdır.
    return metin.replace(/\./g, "").replace(",", ".");
  }
  if (sonNokta > sonVirgul) {
    // Nokta ondalık: virgüller binlik ayracıdır.
    return metin.replace(/,/g, "");
  }
  return metin;
}

/** Örnek şablon — kullanıcı indirip doldurabilsin diye. */
export const ORNEK_CSV = [
  "ad;fiyat;stok;stok kodu;aciklama;gorsel",
  'Örnek Ekran Kartı;24999,90;5;EK-001;8GB GDDR6, çift fanlı;/images/urunler/ekrankart.png',
  'Örnek Klavye;1899,00;20;KL-002;"Mekanik, RGB aydınlatmalı";',
  "Örnek SSD 1TB;3100;30;SSD-1TB;M.2 NVMe Gen4;"
].join("\n");
