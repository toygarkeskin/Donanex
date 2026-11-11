"use strict";

import type { Row, Services } from "../application/shared/contracts";
import type { AppConfig } from "../config/env";

/** Kurulan demo verisinin sayilari. */
export interface DemoSummary {
  readonly stores: number;
  readonly products: number;
  readonly users: number;
  readonly orders: number;
}

/**
 * Demo verisi.
 *
 * Amaç: `docker compose up` sonrası sistemin BOŞ bir ekranla açılmaması.
 * Vitrinde ürün, panellerde sipariş, destek kutusunda talep bulunsun ki her
 * rol ilk saniyeden itibaren gösterilebilsin.
 *
 * Yalnızca SEED_DEMO_DATA=true iken ve veritabanında hiç mağaza yokken
 * çalışır; var olan veriye asla dokunmaz. Üretimde config doğrulaması bu
 * bayrağı zaten reddeder.
 */

import { Product, ProductStatus } from "../domain/catalog/Product";
import { Order } from "../domain/ordering/Order";
import { StoreStatus } from "../domain/stores/Store";
import { PackageStatus, OrderStatus } from "../domain/ordering/OrderStatus";
import { RoleCodes } from "../domain/identity/Role";
import { slugify } from "../domain/shared/guards";

/**
 * Demo kurulumunda "olmasi gerekir" adimlari icin.
 *
 * Bos bir veritabaninda bu cagrilarin hepsi deger dondurur; ama tipleri
 * null kabul ediyor, cunku normal akista (kayitli e-posta, var olan slug)
 * null donebilirler. Burada null gecerse sessizce yarim veri kurmak yerine
 * durup nedenini soyluyoruz.
 */
function zorunlu<T>(deger: T | null | undefined, ne: string): T {
  if (deger === null || deger === undefined) {
    throw new Error(`Demo verisi kurulamadi: ${ne} olusturulamadi.`);
  }
  return deger;
}

/** Demo hesaplarının ortak parolası. Parola kuralını karşılar. */
const DEMO_PASSWORD = "Donanex2026Demo";

const CATEGORIES = [
  "Laptop",
  "Ekran Kartı",
  "İşlemci",
  "Monitör",
  "Klavye",
  "Mouse",
  "Kulaklık",
  "Depolama",
  "Oyun Kumandası"
];

const image = (file: string) => `/images/urunler/${file}`;

/**
 * Demo urun satiri: [ad, aciklama, fiyatKurus, stok, kategori, gorsel].
 *
 * Tuple olarak tiplendi ki sira yanlis yazilirsa derleme dursun; eskiden
 * karisik bir dizi oldugu icin ornegin kategori ile gorseli yer degistirmek
 * sessizce kategorisiz urun uretirdi.
 */
type DemoProduct = readonly [string, string, number, number, string, string];

interface DemoStore {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly owner: { readonly email: string; readonly fullName: string };
  readonly logo: string;
  readonly products: readonly DemoProduct[];
}

const STORES: readonly DemoStore[] = [
  {
    key: "teknoloji-deposu",
    name: "Teknoloji Deposu",
    description:
      "Dizüstü bilgisayarlar ve ekran kartlarında geniş ürün yelpazesi. Tüm ürünler distribütör garantilidir.",
    owner: { email: "teknoloji@donanex.test", fullName: "Elif Kaya" },
    logo: "/images/markalar/msi.png",
    products: [
      ["GIGABYTE GAMING A16 Dizüstü", "Ryzen 7 260, 16GB DDR5, RTX 5060, 16 inç FHD 165Hz oyuncu dizüstü bilgisayarı.", 67000, 12, "Laptop", image("laptopcard.png")],
      ["HP ProBook 450 İş Dizüstü", "15.6 inç, Intel Core i5, 16GB RAM, 512GB SSD. Uzun pil ömrüyle iş kullanımına uygun.", 38500, 9, "Laptop", image("katalog/probook.webp")],
      // Model kodu BİLEREK yazıldı: A15 FA507 serisi aynı ad altında farklı
      // işlemci ve ekran kartlarıyla satılıyor, kod olmadan açıklama yanıltıcı
      // olurdu. Özellikler bu varyanta (FA507NVR) aittir.
      ["ASUS TUF Gaming A15 FA507NVR", "AMD Ryzen 7 7435HS, 16GB DDR5, 512GB PCIe 4.0 NVMe SSD, 8GB RTX 4060 (140W), 15.6 inç FHD 144Hz IPS ekran.", 72000, 6, "Laptop", image("laptop.jpg")],
      ["MSI RTX 5060 Ti SHADOW", "8GB GDDR7, 128 bit, DLSS 4 destekli çift fanlı ekran kartı.", 25000, 7, "Ekran Kartı", image("ekrankarticard.png")],
      ["ASUS Dual RTX Ekran Kartı", "8GB GDDR6, çift fanlı soğutma, kompakt kasalara uygun tasarım.", 21500, 5, "Ekran Kartı", image("asusdual.jpg")],
      ["Yüksek Performans Ekran Kartı", "Oyun ve içerik üretimi için 12GB bellekli ekran kartı.", 29900, 3, "Ekran Kartı", image("ekrankart.png")]
    ]
  },
  {
    key: "oyuncu-dunyasi",
    name: "Oyuncu Dünyası",
    description: "Oyuncu ekipmanları: mekanik klavyeler, yüksek hassasiyetli mouse'lar ve kulaklıklar.",
    owner: { email: "oyuncu@donanex.test", fullName: "Mert Demir" },
    logo: "/images/markalar/razer.png",
    products: [
      ["Logitech G515 TKL Mekanik Klavye", "RGB aydınlatmalı, düşük profilli anahtarlara sahip TKL mekanik klavye.", 5700, 20, "Klavye", image("klavyecard.png")],
      ["RGB Oyuncu Klavyesi", "Tam boyutlu, makro tuşlu ve bilek destekli mekanik oyuncu klavyesi.", 3200, 15, "Klavye", image("klavye.png")],
      ["A4Tech Bloody R73 Mouse", "20000 CPI sensör, kablosuz bağlantı, 8 programlanabilir tuş.", 2600, 25, "Mouse", image("mausecard.png")],
      ["SteelSeries Rival Mouse", "Hafif gövde, kablolu bağlantı, rekabetçi oyunlar için optik sensör.", 1900, 18, "Mouse", image("katalog/rival.png")],
      ["Razer Kraken V3 Kulaklık", "7.1 surround ses, USB bağlantı, hafızalı köpük kulak yastıkları.", 3900, 11, "Kulaklık", image("katalog/razerkrakenv3.jpg")],
      ["Kablosuz Oyun Kumandası", "Bluetooth bağlantılı, titreşim motorlu kablosuz oyun kumandası.", 3200, 14, "Oyun Kumandası", image("xboxkolmavi.jpg")]
    ]
  },
  {
    key: "komponent-market",
    name: "Komponent Market",
    description: "İşlemci, bellek ve depolama birimlerinde uygun fiyat garantisi.",
    owner: { email: "komponent@donanex.test", fullName: "Zeynep Arslan" },
    logo: "/images/markalar/intel.png",
    products: [
      ["Intel Core i7-11700KF İşlemci", "8 çekirdek, 16 iş parçacığı, LGA1200 soketli masaüstü işlemci.", 9800, 16, "İşlemci", image("katalog/i7-11700kf.jpg")],
      ["1TB NVMe SSD", "M.2 PCIe Gen4 arayüz, 7000 MB/s'e varan okuma hızı.", 3100, 30, "Depolama", image("ssd.png")],
      ["2TB NVMe SSD", "Yüksek kapasiteli M.2 NVMe SSD, oyun ve video düzenleme için.", 5400, 12, "Depolama", image("ssd.png")]
    ]
  },
  {
    key: "ekran-dunyasi",
    name: "Ekran Dünyası",
    description: "Oyuncu ve profesyonel monitörlerde uzman mağaza. Ölü piksel garantisi.",
    owner: { email: "ekran@donanex.test", fullName: "Can Yıldız" },
    logo: "/images/markalar/philips.png",
    products: [
      ["Excalibur 27 inç Oyuncu Monitörü", "165Hz yenileme hızı, 1ms tepki süresi, çerçevesiz tasarım.", 8900, 8, "Monitör", image("katalog/excalibur-monitor-27.jpg")],
      ["LG UltraGear 27 inç Monitör", "IPS panel, 144Hz, HDR10 destekli oyuncu monitörü.", 10400, 6, "Monitör", image("katalog/lgmonitor.jpg")]
    ]
  }
];

const CUSTOMERS = [
  { email: "musteri@donanex.test", fullName: "Ayşe Yılmaz", phone: "0555 111 22 33" },
  { email: "ahmet@donanex.test", fullName: "Ahmet Çelik", phone: "0555 444 55 66" }
];

const ADDRESS = {
  fullName: "Ayşe Yılmaz",
  phone: "0555 111 22 33",
  city: "İstanbul",
  district: "Kadıköy",
  line: "Caferağa Mah. Moda Cad. No:12 D:4",
  postalCode: "34710"
};

/**
 * Katalogdaki eksik demo ürünlerini tamamlar.
 *
 * Veritabanı doluyken çalışır ve YALNIZCA ekleme yapar: var olan ürünlere,
 * siparişlere, hesaplara ve fiyatlara dokunmaz. Böylece tanıma yeni bir ürün
 * eklendiğinde veritabanını sıfırlamak gerekmiyor — eski yol buydu ve
 * oluşturulmuş siparişleri silmek demekti.
 *
 * Eşleştirme mağaza + slug üzerinden. Bir ürün elle silinmişse burada yeniden
 * oluşur; bu bilinçli, çünkü tanım demo katalogun ne içermesi gerektiğini
 * söyleyen tek kaynak. Mağazanın kendi eklediği ürünlere karışmaz.
 */
/**
 * Markası boş ürünleri adlarından markaya bağlar.
 *
 * Neden göçte değil de burada: 003_brands.sql markaları oluşturuyor ve o AN
 * var olan ürünleri bağlıyor, ama göçler dondurulmuş anlık görüntülerdir —
 * kendilerinden SONRA eklenen demo ürünlerini göremezler. Taze bir kurulumda
 * (ve testlerde) sıra "göç → tohum" olduğu için markalar ürünsüz kalıyordu:
 * Markalar sayfası boş açılıyordu.
 *
 * Eşleşme ürün adının BAŞINDAKİ markaya bakar. "Ortada geçsin" kuralı
 * kurulsaydı "ASUS TUF" araması başka markaların TUF ürünlerini de
 * yakalardı. Takma adlar, marka adından türetilemeyen kullanımlar içindir.
 */
const MARKA_TAKMA_ADLARI: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "western-digital": ["WD"],
  microsoft: ["Xbox"]
});

export async function markalariBagla(repos: { db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }> } }): Promise<number> {
  const { rows: markalar } = await repos.db.query("SELECT id, slug, name FROM brands");
  let bagli = 0;
  for (const marka of markalar) {
    const onekler = [marka.name as string, ...(MARKA_TAKMA_ADLARI[marka.slug as string] ?? [])];
    for (const onek of onekler) {
      const sonuc = await repos.db.query(
        "UPDATE products SET brand_id = $1 WHERE brand_id IS NULL AND name ILIKE $2 RETURNING id",
        [marka.id, `${onek} %`]
      );
      bagli += sonuc.rows.length;
    }
  }
  return bagli;
}

export async function eksikUrunleriTamamla({
  unitOfWork,
  ids,
  logger
}: Pick<Services, "unitOfWork" | "ids" | "logger">): Promise<{ eklenen: number }> {
  const eklenen = await unitOfWork.run(async (repos) => {
    let sayac = 0;

    for (const definition of STORES) {
      const { rows: magazaSatiri } = await repos.db.query("SELECT id FROM stores WHERE slug = $1", [definition.key]);
      const magaza = magazaSatiri[0];
      // Mağaza yoksa bu tanım bu kuruluma ait değil; sessizce geçilir.
      if (!magaza) continue;

      for (const [name, description, price, stock, category, imageUrl] of definition.products) {
        const slug = slugify(name);
        const { rows: varMi } = await repos.db.query(
          "SELECT 1 FROM products WHERE store_id = $1 AND slug = $2",
          [magaza.id, slug]
        );
        if (varMi.length) continue;

        const { rows: kategoriSatiri } = await repos.db.query("SELECT id FROM categories WHERE slug = $1", [
          slugify(category)
        ]);

        const product = Product.create({
          id: ids.uuid(),
          storeId: magaza.id,
          categoryId: kategoriSatiri[0]?.id ?? null,
          name,
          description,
          price,
          stock,
          imageUrl,
          status: ProductStatus.ACTIVE
        });
        await repos.products.create({ ...product, slug });
        sayac++;
      }
    }

    return sayac;
  });

  if (eklenen) logger.info("Katalogdaki {Count} eksik ürün tamamlandı", { Count: eklenen });
  else logger.info("Demo verisi zaten güncel, eklenecek ürün yok");

  return { eklenen };
}

export async function seedDemoData({
  unitOfWork,
  passwordHasher,
  opaqueTokens,
  ids,
  clock,
  config,
  logger
}: Pick<Services, "unitOfWork" | "passwordHasher" | "opaqueTokens" | "ids" | "clock" | "logger"> & {
  config: AppConfig;
}): Promise<DemoSummary | null> {
  const alreadySeeded = await unitOfWork.run(async ({ db }) => {
    const { rows } = await db.query("SELECT COUNT(*)::int AS total FROM stores");
    return rows[0].total > 0;
  });

  if (alreadySeeded) {
    // Kurulum zaten yapılmış. Veritabanını sıfırlamadan katalogun
    // büyüyebilmesi için yalnızca EKSİK ürünler tamamlanır.
    await eksikUrunleriTamamla({ unitOfWork, ids, logger });
    return null;
  }

  const passwordHash = await passwordHasher.hash(DEMO_PASSWORD);

  const summary = await unitOfWork.run(async (repos) => {
    /* ---------- kategoriler ---------- */
    const categoryIds = new Map<string, string>();
    for (const name of CATEGORIES) {
      const created = await repos.categories.create({ id: ids.uuid(), name, slug: slugify(name), parentId: null });
      const category = zorunlu(created ?? (await repos.categories.findBySlug(slugify(name))), `kategori ${name}`);
      categoryIds.set(name, category.id);
    }

    /** Kullanıcıyı oluşturur ya da var olanı bulur. */
    const createUser = async ({
      email,
      fullName,
      phone = null
    }: {
      email: string;
      fullName: string;
      phone?: string | null;
    }): Promise<Row> => {
      const user = await repos.users.createIfEmailFree({ id: ids.uuid(), email, fullName, phone, passwordHash });
      // E-posta kayitliysa var olan hesap kullanilir.
      if (!user) return zorunlu(await repos.users.findCredentialsByEmail(email), `kullanici ${email}`);
      await repos.users.markEmailVerified(user.id);
      await repos.roles.assign({ userId: user.id, roleCode: RoleCodes.CUSTOMER, storeId: null });
      return user;
    };

    /* ---------- mağazalar, sahipleri ve ürünleri ---------- */
    const createdStores: { store: Row; owner: Row; products: Row[] }[] = [];
    for (const definition of STORES) {
      const owner = await createUser(definition.owner);

      const store = await repos.stores.create({
        id: ids.uuid(),
        slug: definition.key,
        name: definition.name,
        description: definition.description,
        contactEmail: definition.owner.email,
        phone: "0850 000 00 00",
        taxNumber: null,
        status: StoreStatus.ACTIVE,
        ownerUserId: owner.id
      });
      await repos.db.query("UPDATE stores SET logo_url = $1 WHERE id = $2", [definition.logo, store.id]);
      await repos.roles.assign({ userId: owner.id, roleCode: RoleCodes.STORE_OWNER, storeId: store.id });

      const products = [];
      for (const [name, description, price, stock, category, imageUrl] of definition.products) {
        const product = Product.create({
          id: ids.uuid(),
          storeId: store.id,
          categoryId: categoryIds.get(category),
          name,
          description,
          price,
          stock,
          imageUrl,
          status: ProductStatus.ACTIVE
        });
        products.push(await repos.products.create({ ...product, slug: await repos.products.reserveSlug(store.id, product.slug) }));
      }
      createdStores.push({ store, owner, products });
    }

    await markalariBagla(repos);

    /* ---------- mağaza çalışanı (rol ayrımını göstermek için) ---------- */
    const staff = await createUser({ email: "calisan@donanex.test", fullName: "Burak Şahin" });
    await repos.roles.assign({
      userId: staff.id,
      roleCode: RoleCodes.STORE_STAFF,
      storeId: createdStores[0].store.id
    });

    /* ---------- müşteriler ---------- */
    const customers: Row[] = [];
    for (const definition of CUSTOMERS) {
      const customer = await createUser(definition);
      customers.push(customer);
      await repos.users.addAddress(customer.id, { id: ids.uuid(), title: "Ev", ...ADDRESS, fullName: definition.fullName });
    }

    /* ---------- örnek siparişler ---------- */
    // Biri ödenmiş ve iki mağazaya bölünmüş, biri ödeme bekleyen.
    const demoOrders = [
      {
        customer: customers[0],
        lines: [
          { product: createdStores[0].products[0], quantity: 1 },
          { product: createdStores[1].products[0], quantity: 2 }
        ],
        paid: true
      },
      {
        customer: customers[1],
        lines: [{ product: createdStores[2].products[1], quantity: 3 }],
        paid: false
      }
    ];

    let orderCount = 0;
    for (const demo of demoOrders) {
      const productMap = new Map(
        demo.lines.map(({ product }) => {
          const store = zorunlu(
            createdStores.find((entry) => entry.store.id === product.storeId),
            `${product.storeId} magazasi`
          ).store;
          return [
            product.id,
            {
              id: product.id,
              name: product.name,
              priceCents: Number(product.priceCents),
              stock: product.stock,
              status: product.status,
              imageUrl: product.imageUrl,
              storeId: store.id,
              storeName: store.name,
              storeStatus: StoreStatus.ACTIVE
            }
          ];
        })
      );

      const checkout = Order.validateCheckout({
        contact: { email: demo.customer.email, fullName: demo.customer.fullName, phone: ADDRESS.phone },
        shippingAddress: { ...ADDRESS, fullName: demo.customer.fullName }
      });

      const draft = Order.place({
        userId: demo.customer.id,
        checkout,
        lines: demo.lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        products: productMap
      });

      const trackingCode = opaqueTokens.generate();
      const order = await repos.orders.create({
        id: ids.uuid(),
        orderNumber: await repos.orders.nextOrderNumber(),
        trackingCodeHash: opaqueTokens.hash(trackingCode),
        placedAt: clock.now(),
        ...draft
      });

      for (const pkg of draft.packages) {
        for (const item of pkg.items) {
          await repos.products.decreaseStock(item.productId, item.quantity);
        }
      }

      if (demo.paid) {
        await repos.orders.setStatus(order.id, OrderStatus.PAID);
        await repos.orders.recordPayment({
          id: ids.uuid(),
          orderId: order.id,
          provider: "simulated",
          status: "succeeded",
          amountCents: draft.total.cents,
          reference: `SIM-DEMO${orderCount + 1}`,
          createdAt: clock.now()
        });
        // İlk paketi hazırlığa al: mağaza panelinde iş akışı görünsün.
        const packages = await repos.orders.listPackages(order.id);
        await repos.orders.setPackageStatus(packages[0].id, PackageStatus.PREPARING);
      }
      orderCount++;
    }

    /* ---------- destek talebi ---------- */
    await repos.support.createTicket({
      id: ids.uuid(),
      userId: customers[0].id,
      storeId: createdStores[0].store.id,
      orderId: null,
      email: customers[0].email,
      fullName: customers[0].fullName,
      subject: "Kargo ne zaman çıkar?",
      message: "Siparişimin kargoya verilme tarihini öğrenebilir miyim? Teşekkürler.",
      status: "open"
    });

    return {
      stores: createdStores.length,
      products: createdStores.reduce((total, entry) => total + entry.products.length, 0),
      users: createdStores.length + customers.length + 1,
      orders: orderCount
    };
  });

  logger.info(
    "Demo verisi eklendi: {Stores} mağaza, {Products} ürün, {Users} kullanıcı, {Orders} sipariş",
    summary
  );
  printDemoAccounts(config);
  return summary;
}

/** Demo hesaplarını konsola yazar; demoyu gösteren kişi aramak zorunda kalmasın. */
function printDemoAccounts(config: AppConfig): void {
  const rows = [
    ["Mağaza Sahibi", "teknoloji@donanex.test"],
    ["Mağaza Sahibi", "oyuncu@donanex.test"],
    ["Mağaza Çalışanı", "calisan@donanex.test"],
    ["Müşteri", "musteri@donanex.test"],
    ["Müşteri", "ahmet@donanex.test"]
  ];

  console.log(
    [
      "",
      "-".repeat(68),
      "  DEMO HESAPLARI  (hepsinin parolası aynı)",
      "-".repeat(68),
      ...rows.map(([role, email]) => `  ${role.padEnd(18)} ${email}`),
      "",
      `  Parola: ${DEMO_PASSWORD}`,
      "",
      `  Site       : ${config.publicUrl}`,
      "  E-postalar : Mailpit arayüzünde görünür (giden posta internete çıkmaz)",
      "-".repeat(68),
      ""
    ].join("\n")
  );
}

export { DEMO_PASSWORD, STORES, CUSTOMERS };
