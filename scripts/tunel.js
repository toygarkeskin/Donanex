#!/usr/bin/env node
"use strict";

/**
 * Telefonda denemek için HTTPS tüneli açar ve projeyi o adrese ayarlar.
 *
 * Neden gerekli: giriş akışı PKCE kullanıyor, PKCE crypto.subtle istiyor,
 * tarayıcı da crypto.subtle'ı yalnızca güvenli bağlamda (HTTPS ya da
 * localhost) veriyor. Telefondan "http://192.168.x.x:8090" ile açıldığında o
 * nesne hiç tanımlı olmuyor ve giriş ekranı "hazırlanıyor"da takılıyor.
 * Service worker ve "uygulamayı yükle" seçeneği de aynı kuralı istiyor.
 *
 * Neden betik: Cloudflare'in hızlı tüneli her açılışta BAŞKA bir adres
 * veriyor. Adres değişince PUBLIC_URL de değişmek zorunda, yoksa jetonların
 * "iss" alanı yanlış kalıyor ve giriş sessizce kırılıyor. Bunu elle yapmak
 * her denemede dört adım; biri atlanınca çıkan hata ("redirect_uri bu
 * istemci için kayıtlı değil") sebebini hiç söylemiyor.
 *
 * Dönüş adresini (redirect_uri) burada veritabanına YAZMIYORUZ: api açılışta
 * PUBLIC_URL'den kendisi üretiyor (bkz. bootstrap/syncOAuthClients.ts). Elle
 * yazılan bir adres bir sonraki açılışta nasılsa üzerine yazılırdı.
 *
 * Kullanım:
 *   node scripts/tunel.js           # tüneli açar, ayarlar, açık tutar
 *   node scripts/tunel.js --kapat   # tüneli açmaz; yalnızca ayarları yerele döndürür
 *
 * Ctrl+C ile kapatıldığında PUBLIC_URL kendiliğinden yerel adrese döner.
 */

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const KOK = path.resolve(__dirname, "..");
const ENV_YOLU = path.join(KOK, ".env");
const TUNEL_DIZINI = path.join(KOK, ".tunel");
const ADRES_DOSYASI = path.join(TUNEL_DIZINI, "adres.txt");
const GUNLUK = path.join(TUNEL_DIZINI, "tunel.log");

/** Docker Desktop açılışta yavaş geliyor; görev zamanlayıcıdan çalışırken beklemek gerekiyor. */
const YIGIN_BEKLEME_MS = 5 * 60 * 1000;
/** cloudflared adresi normalde 5-10 saniyede veriyor. */
const ADRES_BEKLEME_MS = 90 * 1000;
/** api yeniden başlatıldıktan sonra sağlıklı olması için. */
const API_BEKLEME_MS = 120 * 1000;

const CLOUDFLARED_ADAYLARI = [
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
  "cloudflared"
];

// ---------------------------------------------------------------- günlük

function yaz(satir) {
  const damga = new Date().toISOString();
  const metin = `${damga} ${satir}`;
  console.log(metin);
  try {
    fs.mkdirSync(TUNEL_DIZINI, { recursive: true });
    fs.appendFileSync(GUNLUK, metin + os.EOL);
  } catch {
    // Günlük yazılamıyorsa iş durmasın; ekrana zaten bastık.
  }
}

// ---------------------------------------------------------------- .env

/**
 * .env'deki tek bir anahtarı değiştirir, geri kalan her satıra dokunmaz.
 *
 * Dosyayı baştan yazmıyoruz: içinde SMTP parolası, JWT anahtarı ve pepper
 * gibi yeniden üretilemeyecek değerler var. Satır sonu da korunuyor; aksi
 * halde dosya her çalıştırmada tümden değişmiş görünür.
 */
function envYaz(anahtar, deger) {
  const ham = fs.readFileSync(ENV_YOLU, "utf8");
  const son = ham.includes("\r\n") ? "\r\n" : "\n";
  const satirlar = ham.split(/\r?\n/);
  const desen = new RegExp(`^${anahtar}=`);
  let bulundu = false;

  const yeni = satirlar.map((satir) => {
    if (!desen.test(satir)) return satir;
    bulundu = true;
    return `${anahtar}=${deger}`;
  });

  if (!bulundu) yeni.push(`${anahtar}=${deger}`);
  fs.writeFileSync(ENV_YOLU, yeni.join(son));
}

function envOku(anahtar) {
  const ham = fs.readFileSync(ENV_YOLU, "utf8");
  for (const satir of ham.split(/\r?\n/)) {
    const esle = satir.match(new RegExp(`^${anahtar}=(.*)$`));
    if (esle) return esle[1].trim();
  }
  return "";
}

/** Tünel kapandığında dönülecek adres. */
function yerelAdres() {
  const port = envOku("WEB_PORT") || "8090";
  return `http://localhost:${port}`;
}

// ---------------------------------------------------------------- docker

function compose(args, { sessiz = false } = {}) {
  const sonuc = spawnSync("docker", ["compose", ...args], {
    cwd: KOK,
    encoding: "utf8",
    shell: false
  });
  if (!sessiz && sonuc.status !== 0) {
    yaz(`docker compose ${args.join(" ")} basarisiz: ${(sonuc.stderr || "").trim()}`);
  }
  return sonuc;
}

function apiSaglikli() {
  const sonuc = compose(["ps", "--format", "{{.Service}} {{.Health}}"], { sessiz: true });
  if (sonuc.status !== 0) return false;
  return (sonuc.stdout || "").split(/\r?\n/).some((satir) => /^api\s+healthy/.test(satir.trim()));
}

/** Projenin ayakta olan konteyner sayısı. */
function ayaktaSayisi() {
  const sonuc = compose(["ps", "--format", "{{.Service}}"], { sessiz: true });
  if (sonuc.status !== 0) return 0;
  return (sonuc.stdout || "").split(/\r?\n/).filter((satir) => satir.trim()).length;
}

const bekle = (ms) => new Promise((coz) => setTimeout(coz, ms));

/**
 * Yığının ayağa kalkmasını bekler, gerekirse kendisi başlatır.
 *
 * Açılışta otomatik çalıştığında Docker Desktop henüz hazır olmuyor; bu
 * bekleme olmadan betik "docker yok" diye düşer ve telefon çalışmaz.
 */
async function yiginiBekle() {
  const bitis = Date.now() + YIGIN_BEKLEME_MS;
  let baslatmaDenendi = false;

  while (Date.now() < bitis) {
    if (apiSaglikli()) return true;

    const dockerVar = spawnSync("docker", ["info"], { encoding: "utf8", shell: false }).status === 0;
    /*
     * Yığını YALNIZCA hiçbir konteyner ayakta değilken başlatıyoruz.
     *
     * Önce "api sağlıklı değilse up -d" deniyordu ve bu yan etkiliydi: sade
     * "up -d", docker-compose.dev.yml ile başlatılmış servisleri override'sız
     * yeniden kuruyor, yani db'nin 5434 portu yayından düşüyor ve bütünleşme
     * testleri sessizce çalışmaz oluyor. Yığın zaten ayaktaysa beklemek doğru
     * davranış: api büyük olasılıkla açılıyor.
     */
    if (dockerVar && !baslatmaDenendi && ayaktaSayisi() === 0) {
      yaz("Yigin ayakta degil, baslatiliyor: docker compose up -d");
      compose(["up", "-d"]);
      baslatmaDenendi = true;
    }
    await bekle(5000);
  }
  return false;
}

// ---------------------------------------------------------------- cloudflared

function cloudflaredBul() {
  for (const aday of CLOUDFLARED_ADAYLARI) {
    if (aday === "cloudflared") {
      if (spawnSync(aday, ["--version"], { encoding: "utf8", shell: false }).status === 0) return aday;
      continue;
    }
    if (fs.existsSync(aday)) return aday;
  }
  return null;
}

/**
 * Tüneli açar ve verdiği adresi döndürür.
 *
 * Adres cloudflared'ın GÜNLÜĞÜNDE geçiyor, standart çıktısında değil; bu
 * yüzden iki akışı birden dinliyoruz.
 */
function tuneliAc(exe, hedef) {
  return new Promise((coz, yad) => {
    const surec = spawn(exe, ["tunnel", "--url", hedef, "--no-autoupdate"], {
      cwd: KOK,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let cozuldu = false;
    const zamanAsimi = setTimeout(() => {
      if (cozuldu) return;
      cozuldu = true;
      surec.kill();
      yad(new Error("cloudflared adres vermedi (90 sn)"));
    }, ADRES_BEKLEME_MS);

    const dinle = (veri) => {
      const metin = String(veri);
      try {
        fs.appendFileSync(path.join(TUNEL_DIZINI, "cloudflared.log"), metin);
      } catch {
        /* günlük yazılamazsa iş durmasın */
      }
      const esle = metin.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (esle && !cozuldu) {
        cozuldu = true;
        clearTimeout(zamanAsimi);
        coz({ surec, adres: esle[0] });
      }
    };

    surec.stdout.on("data", dinle);
    surec.stderr.on("data", dinle);
    surec.on("error", (hata) => {
      if (cozuldu) return;
      cozuldu = true;
      clearTimeout(zamanAsimi);
      yad(hata);
    });
    surec.on("exit", (kod) => {
      if (cozuldu) return;
      cozuldu = true;
      clearTimeout(zamanAsimi);
      yad(new Error(`cloudflared ${kod} ile cikti`));
    });
  });
}

// ---------------------------------------------------------------- akış

/**
 * api'nin saglikli olmasini bekler.
 *
 * Gerekli, cunku "docker compose up -d" sifir donse bile konteyner
 * "created" durumunda kalabiliyor. Bu kontrol olmadan betik "hazir" diye
 * banner basiyordu, oysa api hic calismiyordu; arıza ancak telefonda
 * giriş denenince ortaya cikiyordu.
 */
async function apiyiBekle(sureMs) {
  const bitis = Date.now() + sureMs;
  while (Date.now() < bitis) {
    if (apiSaglikli()) return true;
    await bekle(3000);
  }
  return false;
}

async function ayarlariUygula(adres) {
  envYaz("PUBLIC_URL", adres);
  yaz(`PUBLIC_URL=${adres}`);
  yaz("api ve worker yeniden baslatiliyor (yeni issuer ve dönüş adresi için)");
  compose(["up", "-d", "--force-recreate", "api", "worker"]);

  if (await apiyiBekle(API_BEKLEME_MS)) return true;

  yaz("api saglikli olmadi, bir kez daha deneniyor: docker compose up -d api worker");
  compose(["up", "-d", "api", "worker"]);
  if (await apiyiBekle(API_BEKLEME_MS)) return true;

  yaz("HATA: api ayaga kalkmadi. Gunluk: docker compose logs api");
  return false;
}

function yereleDon(oncekiAdres) {
  const hedef = oncekiAdres || yerelAdres();
  yaz(`Ayarlar yerele donduruluyor: ${hedef}`);
  envYaz("PUBLIC_URL", hedef);
  compose(["up", "-d", "--force-recreate", "api", "worker"]);
  try {
    fs.rmSync(ADRES_DOSYASI, { force: true });
  } catch {
    /* önemsiz */
  }
}

async function main() {
  fs.mkdirSync(TUNEL_DIZINI, { recursive: true });

  if (process.argv.includes("--kapat")) {
    yereleDon(yerelAdres());
    yaz("Bitti. Tunel surecini ayrica kapatmaniz gerekir.");
    return;
  }

  const exe = cloudflaredBul();
  if (!exe) {
    yaz("cloudflared bulunamadi. Kurulum: winget install --id Cloudflare.cloudflared");
    process.exitCode = 1;
    return;
  }

  yaz("Yigin bekleniyor...");
  if (!(await yiginiBekle())) {
    yaz("Yigin 5 dakikada hazir olmadi. Docker Desktop acik mi?");
    process.exitCode = 1;
    return;
  }
  yaz("Yigin hazir.");

  const yerel = yerelAdres();
  const { surec, adres } = await tuneliAc(exe, yerel);
  yaz(`Tunel adresi: ${adres}`);
  fs.writeFileSync(ADRES_DOSYASI, adres + os.EOL);

  const hazir = await ayarlariUygula(adres);

  yaz("");
  yaz("===========================================================");
  if (!hazir) {
    yaz("  DIKKAT: tunel acik ama api calismiyor; giris calismaz.");
  }
  yaz(`  Telefonda bu adresi acin: ${adres}`);
  yaz("  Surec yasadigi surece calisir.");
  yaz("  Elle calistirildiysa Ctrl+C; gorevden calisiyorsa:");
  yaz("  Stop-ScheduledTask -TaskName Donanex-Tunel");
  yaz("===========================================================");

  let kapaniyor = false;
  const kapat = () => {
    if (kapaniyor) return;
    kapaniyor = true;
    yaz("Kapatiliyor...");
    try {
      surec.kill();
    } catch {
      /* zaten olmus olabilir */
    }
    yereleDon(yerel);
    process.exit(0);
  };

  process.on("SIGINT", kapat);
  process.on("SIGTERM", kapat);
  surec.on("exit", (kod) => {
    yaz(`cloudflared kapandi (${kod}).`);
    kapat();
  });
}

main().catch((hata) => {
  yaz(`Hata: ${hata.message}`);
  process.exitCode = 1;
});
