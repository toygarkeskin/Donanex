

const express = require("express");
const nodemailer = require("nodemailer");

const path = require("path");

const crypto = require("crypto");

require("dotenv").config();

const { Pool } = require("pg");



const app = express();

const PORT = Number(process.env.PORT || 3000);

const IS_PRODUCTION = process.env.NODE_ENV === "production";



const pool = new Pool({

  host: process.env.DB_HOST || "127.0.0.1",

  port: Number(process.env.DB_PORT || 5432),

  database: process.env.DB_NAME,

  user: process.env.DB_USER,

  password: process.env.DB_PASSWORD

});



app.disable("x-powered-by");

app.use(express.json({ limit: "50kb" }));



const OKUL_DIR = path.join(__dirname, "OKUL");

app.use(express.static(OKUL_DIR));



const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const SESSION_SECRET = process.env.SESSION_SECRET || "";



// Müşteri sipariş takibi: veritabanında yalnızca kodun özeti tutulur.

function createOrderTrackingCode() {

  return crypto.randomBytes(24).toString("hex");

}



function hashOrderTrackingCode(code) {

  return crypto.createHash("sha256").update(code).digest("hex");

}



function safeStringEqual(a, b) {

  const first = Buffer.from(String(a));

  const second = Buffer.from(String(b));

  return first.length === second.length &&

    crypto.timingSafeEqual(first, second);

}



function createSession(username) {

  const payload = Buffer.from(JSON.stringify({

    username,

    expiresAt: Date.now() + 8 * 60 * 60 * 1000

  })).toString("base64url");



  const signature = crypto

    .createHmac("sha256", SESSION_SECRET)

    .update(payload)

    .digest("base64url");



  return `${payload}.${signature}`;

}



function verifySession(token) {

  if (!token || !SESSION_SECRET) return null;



  const parts = token.split(".");

  if (parts.length !== 2) return null;



  const expected = crypto

    .createHmac("sha256", SESSION_SECRET)

    .update(parts[0])

    .digest("base64url");



  if (!safeStringEqual(parts[1], expected)) return null;



  try {

    const payload = JSON.parse(

      Buffer.from(parts[0], "base64url").toString("utf8")

    );



    if (

      !payload.username ||

      !payload.expiresAt ||

      payload.expiresAt < Date.now()

    ) return null;



    if (!safeStringEqual(payload.username, ADMIN_USERNAME)) return null;

    return payload;

  } catch {

    return null;

  }

}







function createCustomerSession(customerId) {

  const payload = Buffer.from(

    JSON.stringify({

      customerId: String(customerId),

      expiresAt: Date.now() + 8 * 60 * 60 * 1000

    })

  ).toString("base64url");



  const signature = crypto

    .createHmac("sha256", SESSION_SECRET)

    .update(payload)

    .digest("base64url");



  return `${payload}.${signature}`;

}



function verifyCustomerSession(token) {

  if (!token || !SESSION_SECRET || SESSION_SECRET.length < 32) {

    return null;

  }



  const parts = token.split(".");

  if (parts.length !== 2) return null;



  const expected = crypto

    .createHmac("sha256", SESSION_SECRET)

    .update(parts[0])

    .digest("base64url");



  if (!safeStringEqual(parts[1], expected)) return null;



  try {

    const payload = JSON.parse(

      Buffer.from(parts[0], "base64url").toString("utf8")

    );



    if (

      !payload.customerId ||

      !/^\d+$/.test(payload.customerId) ||

      !payload.expiresAt ||

      payload.expiresAt < Date.now()

    ) {

      return null;

    }



    return payload;

  } catch {

    return null;

  }

}







function parseCookies(req) {

  const result = {};

  const header = req.headers.cookie || "";



  for (const item of header.split(";")) {

    const index = item.indexOf("=");

    if (index < 0) continue;



    const key = item.slice(0, index).trim();

    const value = item.slice(index + 1).trim();



    try {

      result[key] = decodeURIComponent(value);

    } catch {}

  }



  return result;

}



function adminAuth(req, res, next) {

  const token = parseCookies(req).admin_session;

  const session = verifySession(token);



  if (!session) {

    return res.status(401).json({

      success: false,

      message: "Yönetici girişi gerekli."

    });

  }



  req.admin = session;

  next();

}



function requireTestMode(req, res, next) {

  if (IS_PRODUCTION) {

    return res.status(404).json({

      success: false,

      message: "Bulunamadı."

    });

  }

  next();

}



function validProduct(body) {

  return body &&

    Number.isInteger(Number(body.stock)) &&

    Number(body.stock) >= 0 &&

    Number(body.stock) <= 1000000 &&

    typeof body.name === "string" &&

    body.name.trim().length > 0 &&

    body.name.trim().length <= 250 &&

    typeof body.description === "string" &&

    body.description.trim().length > 0 &&

    Number.isFinite(Number(body.price)) &&

    Number(body.price) >= 0 &&

    Number.isSafeInteger(Math.round(Number(body.price) * 100)) &&

    typeof body.image === "string" &&

    body.image.trim().length > 0 &&

    body.image.trim().length <= 500 &&

    typeof body.category === "string" &&

    body.category.trim().length > 0 &&

    body.category.trim().length <= 100;

}



// SAĞLIK VE VERİTABANI TESTİ



app.get("/api/health", (req, res) => {

  res.json({

    success: true,

    message: "Backend sunucusu çalışıyor!"

  });

});



app.get("/api/db-test", async (req, res) => {

  try {

    const result = await pool.query(

      "SELECT current_database() AS database"

    );



    res.json({

      success: true,

      message: "PostgreSQL bağlantısı başarılı!",

      database: result.rows[0].database

    });

  } catch (error) {

    console.error("Veritabanı hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Veritabanına bağlanılamadı."

    });

  }

});



// ÜRÜNLERİ LİSTELE



app.get("/api/products", async (req, res) => {

  try {

    const result = await pool.query(

      "SELECT id, name, description, price, image, category, stock FROM products ORDER BY id"

    );



    res.json({ success: true, products: result.rows });

  } catch (error) {

    console.error("Ürün listeleme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Ürünler alınamadı."

    });

  }

});



// SİPARİŞ OLUŞTUR



app.post("/api/orders", async (req, res) => {

  const { adSoyad, email, telefon, adres, items } = req.body || {};



  if (

    typeof adSoyad !== "string" ||

    !adSoyad.trim() ||

    adSoyad.trim().length > 150 ||

    typeof email !== "string" ||

    email.length > 254 ||

    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||

    typeof telefon !== "string" ||

    !telefon.trim() ||

    telefon.length > 30 ||

    typeof adres !== "string" ||

    !adres.trim() ||

    adres.length > 1000 ||

    !Array.isArray(items) ||

    items.length === 0 ||

    items.length > 100 ||

    !items.every(item =>

      item &&

      typeof item.name === "string" &&

      item.name.trim().length > 0 &&

      item.name.trim().length <= 250

    )

  ) {

    return res.status(400).json({

      success: false,

      message: "Lütfen alıcı bilgilerini ve sepetinizi kontrol edin."

    });

  }



  let client;



  try {

    client = await pool.connect();

    await client.query("BEGIN");



    const names = items.map(item => item.name.trim());



    const productResult = await client.query(

      "SELECT id, name, price, stock FROM products WHERE name = ANY($1::varchar[]) ORDER BY id FOR UPDATE",

      [names]

    );



    const productsByName = new Map(

      productResult.rows.map(product => [product.name, product])

    );



    const quantities = new Map();



    for (const name of names) {

      if (!productsByName.has(name)) {

        await client.query("ROLLBACK");

        return res.status(400).json({

          success: false,

          message: "Sepetinizde geçersiz veya bulunmayan bir ürün var."

        });

      }



      quantities.set(name, (quantities.get(name) || 0) + 1);

    }



    let total = 0;

    const orderItems = [];



    for (const [name, quantity] of quantities) {

      const product = productsByName.get(name);

      const price = Number(product.price);



      if (Number(product.stock) < quantity) {

        await client.query("ROLLBACK");

        return res.status(409).json({

          success: false,

          message: `"${product.name}" ürününden yeterli stok yok. Mevcut stok: ${product.stock}`

        });

      }



      total += price * quantity;



      orderItems.push({

        productId: product.id,

        name: product.name,

        quantity,

        price

      });

    }



    if (

      !Number.isFinite(total) ||

      !Number.isSafeInteger(Math.round(total * 100))

    ) {

      throw new Error("Sipariş tutarı geçersiz.");

    }



    const trackingCode = createOrderTrackingCode();

    const trackingCodeHash = hashOrderTrackingCode(trackingCode);



    const orderResult = await client.query(

      `INSERT INTO orders

        (customer_name, email, phone, address, total, status, tracking_code_hash)

       VALUES ($1, $2, $3, $4, $5, $6, $7)

       RETURNING id, total`,

      [

        adSoyad.trim(),

        email.trim(),

        telefon.trim(),

        adres.trim(),

        total.toFixed(2),

        "Ödeme bekleniyor",

        trackingCodeHash

      ]

    );



    const order = orderResult.rows[0];



    for (const item of orderItems) {

      await client.query(

        `INSERT INTO order_items

          (order_id, product_id, product_name, quantity, unit_price)

         VALUES ($1, $2, $3, $4, $5)`,

        [

          order.id,

          item.productId,

          item.name,

          item.quantity,

          item.price.toFixed(2)

        ]

      );

      await client.query(

        "UPDATE products SET stock = stock - $1 WHERE id = $2",

        [item.quantity, item.productId]

      );

    }



    await client.query("COMMIT");



    res.status(201).json({

      success: true,

      message: "Sipariş oluşturuldu.",

      orderId: order.id,

      total: order.total,

      status: "Ödeme bekleniyor",

      trackingCode

    });

  } catch (error) {

    if (client) {

      try {

        await client.query("ROLLBACK");

      } catch (rollbackError) {

        console.error("Geri alma hatası:", rollbackError.message);

      }

    }



    console.error("Sipariş oluşturma hatası:", error.message);



    res.status(500).json({

      success: false,

      message: "Sipariş kaydedilemedi. Lütfen tekrar deneyin."

    });

  } finally {

    if (client) client.release();

  }

});



// TEST ÖDEME SİSTEMİ - GERÇEK ÖDEME ALMAZ



app.get("/api/orders/:id", requireTestMode, async (req, res) => {

  if (!/^\d+$/.test(req.params.id)) {

    return res.status(400).json({

      success: false,

      message: "Geçersiz sipariş numarası."

    });

  }



  try {

    const result = await pool.query(

      "SELECT id, total, status FROM orders WHERE id = $1",

      [req.params.id]

    );



    if (!result.rowCount) {

      return res.status(404).json({

        success: false,

        message: "Sipariş bulunamadı."

      });

    }



    res.json({ success: true, order: result.rows[0] });

  } catch (error) {

    console.error("Sipariş sorgulama hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Sipariş alınamadı."

    });

  }

});



app.post("/api/orders/:id/test-payment", requireTestMode, async (req, res) => {

  if (

    !/^\d+$/.test(req.params.id) ||

    typeof req.body?.successful !== "boolean"

  ) {

    return res.status(400).json({

      success: false,

      message: "Geçersiz test isteği."

    });

  }



  const status = req.body.successful

    ? "Test başarılı"

    : "Test başarısız";



  try {

    const result = await pool.query(

      `UPDATE orders

       SET status = $1

       WHERE id = $2 AND status = 'Ödeme bekleniyor'

       RETURNING id, status, total`,

      [status, req.params.id]

    );



    if (!result.rowCount) {

      return res.status(409).json({

        success: false,

        message: "Sipariş bulunamadı veya daha önce işlenmiş."

      });

    }



    res.json({

      success: true,

      message: "Test sonucu kaydedildi. Gerçek ödeme alınmadı.",

      order: result.rows[0]

    });

  } catch (error) {

    console.error("Test ödeme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Test sonucu kaydedilemedi."

    });

  }

});



// MÜŞTERİ SİPARİŞ TAKİBİ

// Sipariş numarası ve tek sefer gösterilen takip kodu birlikte gerekir.

app.post("/api/order-tracking", async (req, res) => {

  const { orderId, trackingCode } = req.body || {};



  if (

    !/^\d+$/.test(String(orderId || "")) ||

    typeof trackingCode !== "string" ||

    !/^[a-f0-9]{48}$/.test(trackingCode)

  ) {

    return res.status(400).json({

      success: false,

      message: "Sipariş numarası veya takip kodu geçersiz."

    });

  }



  try {

    const trackingCodeHash = hashOrderTrackingCode(trackingCode);

    const result = await pool.query(

      `SELECT id, status, created_at,

              shipping_company, tracking_number, tracking_url

       FROM orders

       WHERE id = $1 AND tracking_code_hash = $2`,

      [orderId, trackingCodeHash]

    );



    if (!result.rowCount) {

      return res.status(404).json({

        success: false,

        message: "Sipariş bulunamadı veya takip kodu yanlış."

      });

    }



    return res.json({ success: true, order: result.rows[0] });

  } catch (error) {

    console.error("Müşteri sipariş takip hatası:", error.message);

    return res.status(500).json({

      success: false,

      message: "Sipariş bilgileri şu anda alınamadı."

    });

  }

});



// YÖNETİCİ OTURUMU



app.get("/api/admin/session", (req, res) => {

  const session = verifySession(parseCookies(req).admin_session);



  res.json({

    success: true,

    authenticated: Boolean(session),

    username: session?.username || null

  });

});





// MÜŞTERİ ŞİFRE GÜVENLİĞİ

function hashCustomerPassword(password) {

  return new Promise((resolve, reject) => {

    const salt = crypto.randomBytes(16).toString("hex");



    crypto.scrypt(password, salt, 64, (err, key) => {

      if (err) return reject(err);

      resolve(`${salt}:${key.toString("hex")}`);

    });

  });

}



function verifyCustomerPassword(password, storedHash) {

  return new Promise((resolve, reject) => {

    const [salt, keyHex] = String(storedHash).split(":");



    if (!salt || !keyHex || !/^[a-f0-9]+$/i.test(keyHex)) {

      return resolve(false);

    }



    const expected = Buffer.from(keyHex, "hex");



    crypto.scrypt(password, salt, expected.length, (err, key) => {

      if (err) return reject(err);



      resolve(

        expected.length === key.length &&

        crypto.timingSafeEqual(expected, key)

      );

    });

  });

}





// MÜŞTERİ KAYIT

app.post("/api/customers/register", async (req, res) => {

  try {

    const { name, email, password } = req.body || {};



    if (

      typeof name !== "string" ||

      typeof email !== "string" ||

      typeof password !== "string"

    ) {

      return res.status(400).json({

        success: false,

        message: "Tüm alanları doldur."

      });

    }



    const cleanName = name.trim();

    const cleanEmail = email.trim().toLowerCase();



    if (cleanName.length < 2 || cleanName.length > 150) {

      return res.status(400).json({

        success: false,

        message: "Ad en az 2 karakter olmalı."

      });

    }



    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {

      return res.status(400).json({

        success: false,

        message: "Geçerli bir e-posta gir."

      });

    }



    if (password.length < 8 || password.length > 128) {

      return res.status(400).json({

        success: false,

        message: "Şifre 8-128 karakter arasında olmalı."

      });

    }



    const passwordHash = await hashCustomerPassword(password);



    const result = await pool.query(

      `INSERT INTO customers (name, email, password_hash)

       VALUES ($1, $2, $3)

       ON CONFLICT (email) DO NOTHING

       RETURNING id, name, email`,

      [cleanName, cleanEmail, passwordHash]

    );



    if (result.rowCount === 0) {

      return res.status(409).json({

        success: false,

        message: "Bu e-posta zaten kayıtlı."

      });

    }



    return res.status(201).json({

      success: true,

      message: "Kayıt başarılı. Şimdi giriş yapabilirsin."

    });

  } catch (error) {

    console.error("Müşteri kayıt hatası:", error.message);

    return res.status(500).json({

      success: false,

      message: "Kayıt sırasında hata oluştu."

    });

  }

});



// MÜŞTERİ GİRİŞ
app.post("/api/customers/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "E-posta ve şifre gir."
      });
    }

    if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
      return res.status(503).json({
        success: false,
        message: "Oturum ayarları sunucuda eksik."
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM customers
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const customer = result.rows[0];

    if (
      !customer ||
      !(await verifyCustomerPassword(password, customer.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "E-posta veya şifre hatalı."
      });
    }

    const token = createCustomerSession(customer.id);

    res.setHeader(
      "Set-Cookie",
      `customer_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${IS_PRODUCTION ? "; Secure" : ""}`
    );

    return res.json({
      success: true,
      message: "Giriş başarılı.",
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email
      }
    });
  } catch (error) {
    console.error("Müşteri giriş hatası:", error.message);

    return res.status(500).json({
      success: false,
      message: "Giriş sırasında hata oluştu."
    });
  }
});

// MÜŞTERİ OTURUM KONTROLÜ
app.get("/api/customers/session", async (req, res) => {
  try {
    const session = verifyCustomerSession(
      parseCookies(req).customer_session
    );

    if (!session) {
      return res.json({
        success: true,
        authenticated: false,
        customer: null
      });
    }

    const result = await pool.query(
      "SELECT id, name, email FROM customers WHERE id = $1",
      [session.customerId]
    );

    const customer = result.rows[0];

    if (!customer) {
      return res.json({
        success: true,
        authenticated: false,
        customer: null
      });
    }

    return res.json({
      success: true,
      authenticated: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email
      }
    });
  } catch (error) {
    console.error("Müşteri oturum kontrolü hatası:", error.message);

    return res.status(500).json({
      success: false,
      message: "Oturum kontrolünde hata oluştu."
    });
  }
});

// MÜŞTERİ ÇIKIŞ
app.post("/api/customers/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `customer_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${IS_PRODUCTION ? "; Secure" : ""}`
  );

  return res.json({
    success: true,
    message: "Çıkış yapıldı."
  });
});

app.post("/api/admin/login", (req, res) => {

  if (

    !ADMIN_USERNAME ||

    !ADMIN_PASSWORD ||

    !SESSION_SECRET ||

    SESSION_SECRET.length < 32

  ) {

    return res.status(503).json({

      success: false,

      message: "Yönetici ayarları eksik. .env dosyasını kontrol edin."

    });

  }



  const { username, password } = req.body || {};



  if (

    typeof username !== "string" ||

    typeof password !== "string" ||

    !safeStringEqual(username, ADMIN_USERNAME) ||

    !safeStringEqual(password, ADMIN_PASSWORD)

  ) {

    return res.status(401).json({

      success: false,

      message: "Kullanıcı adı veya parola hatalı."

    });

  }



  const token = createSession(ADMIN_USERNAME);



  res.setHeader(

    "Set-Cookie",

    `admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${IS_PRODUCTION ? "; Secure" : ""}`

  );



  res.json({ success: true, message: "Giriş başarılı." });

});



app.post("/api/admin/logout", (req, res) => {

  res.setHeader(

    "Set-Cookie",

    `admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${IS_PRODUCTION ? "; Secure" : ""}`

  );



  res.json({ success: true, message: "Çıkış yapıldı." });

});



// YÖNETİCİ İSTATİSTİKLERİ



app.get("/api/admin/stats", adminAuth, async (req, res) => {

  try {

    const result = await pool.query(`

      SELECT

        (SELECT COUNT(*)::int FROM products) AS product_count,

        (SELECT COUNT(*)::int FROM orders) AS order_count,

        (SELECT COUNT(*)::int FROM orders

          WHERE status = 'Ödeme bekleniyor') AS pending_count,

        (SELECT COUNT(*)::int FROM orders

          WHERE status = 'Test başarılı') AS test_success_count,

        (SELECT COUNT(*)::int FROM orders

          WHERE status = 'Test başarısız') AS test_failed_count

    `);



    res.json({ success: true, stats: result.rows[0] });

  } catch (error) {

    console.error("İstatistik hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "İstatistikler alınamadı."

    });

  }

});



// YÖNETİCİ ÜRÜN LİSTESİ



app.get("/api/admin/products", adminAuth, async (req, res) => {

  try {

    const result = await pool.query(

      `SELECT id, name, description, price, image, category, stock, created_at

       FROM products ORDER BY id DESC`

    );



    res.json({ success: true, products: result.rows });

  } catch (error) {

    console.error("Yönetim ürün listeleme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Ürünler alınamadı."

    });

  }

});



// ÜRÜN EKLE



app.post("/api/admin/products", adminAuth, async (req, res) => {

  if (!validProduct(req.body)) {

    return res.status(400).json({

      success: false,

      message: "Ürün bilgilerini ve fiyatını kontrol edin."

    });

  }



  const { name, description, price, image, category } = req.body;



  try {

    const result = await pool.query(

      `INSERT INTO products (name, description, price, image, category, stock)

       VALUES ($1, $2, $3, $4, $5, $6)

       RETURNING id, name, description, price, image, category, stock`,

      [

        name.trim(),

        description.trim(),

        Number(price).toFixed(2),

        image.trim(),

        category.trim(),

        Number(req.body.stock)

      ]

    );



    res.status(201).json({

      success: true,

      product: result.rows[0],

      message: "Ürün eklendi."

    });

  } catch (error) {

    console.error("Ürün ekleme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Ürün eklenemedi."

    });

  }

});



// ÜRÜN DÜZENLE



app.put("/api/admin/products/:id", adminAuth, async (req, res) => {

  if (!/^\d+$/.test(req.params.id) || !validProduct(req.body)) {

    return res.status(400).json({

      success: false,

      message: "Ürün bilgilerini kontrol edin."

    });

  }



  const { name, description, price, image, category } = req.body;



  try {

    const result = await pool.query(

      `UPDATE products

       SET name=$1, description=$2, price=$3, image=$4, category=$5, stock=$6

       WHERE id=$7

       RETURNING id, name, description, price, image, category, stock`,

      [

        name.trim(),

        description.trim(),

        Number(price).toFixed(2),

        image.trim(),

        category.trim(),

        Number(req.body.stock),

        req.params.id

      ]

    );



    if (!result.rowCount) {

      return res.status(404).json({

        success: false,

        message: "Ürün bulunamadı."

      });

    }



    res.json({

      success: true,

      product: result.rows[0],

      message: "Ürün güncellendi."

    });

  } catch (error) {

    console.error("Ürün güncelleme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Ürün güncellenemedi."

    });

  }

});



// ÜRÜN SİL



app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {

  if (!/^\d+$/.test(req.params.id)) {

    return res.status(400).json({

      success: false,

      message: "Geçersiz ürün numarası."

    });

  }



  try {

    const result = await pool.query(

      "DELETE FROM products WHERE id=$1 RETURNING id",

      [req.params.id]

    );



    if (!result.rowCount) {

      return res.status(404).json({

        success: false,

        message: "Ürün bulunamadı."

      });

    }



    res.json({ success: true, message: "Ürün silindi." });

  } catch (error) {

    if (error.code === "23503") {

      return res.status(409).json({

        success: false,

        message: "Bu ürün geçmiş siparişlerde kullanıldığı için silinemiyor. Ürünü düzenleyebilir veya satıştan kaldırmak için adını değiştirebilirsiniz."

      });

    }



    console.error("Ürün silme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Ürün silinemedi."

    });

  }

});



// YÖNETİCİ SİPARİŞ LİSTESİ



app.get("/api/admin/orders", adminAuth, async (req, res) => {

  try {

    const result = await pool.query(`

      SELECT

        o.id,

        o.customer_name,

        o.email,

        o.phone,

        o.address,

        o.total,

        o.status,

        o.created_at,

        o.shipping_company,

        o.tracking_number,

        o.tracking_url,

        COALESCE(

          json_agg(

            json_build_object(

              'name', oi.product_name,

              'quantity', oi.quantity,

              'unit_price', oi.unit_price

            )

          ) FILTER (WHERE oi.id IS NOT NULL),

          '[]'::json

        ) AS items

      FROM orders o

      LEFT JOIN order_items oi ON oi.order_id = o.id

      GROUP BY o.id

      ORDER BY o.created_at DESC

      LIMIT 200

    `);



    res.json({ success: true, orders: result.rows });

  } catch (error) {

    console.error("Sipariş listeleme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Siparişler alınamadı."

    });

  }

});



// SİPARİŞ DURUMUNU GÜNCELLE



app.patch("/api/admin/orders/:id/status", adminAuth, async (req, res) => {

  if (!/^\d+$/.test(req.params.id)) {

    return res.status(400).json({

      success: false,

      message: "Geçersiz sipariş numarası."

    });

  }



  const allowedStatuses = [

    "Ödeme bekleniyor",

    "Test başarılı",

    "Test başarısız",

    "Hazırlanıyor",

    "Kargoya verildi",

    "Teslim edildi",

    "Tamamlandı",

    "İptal edildi"

  ];



  const { status } = req.body || {};



  if (!allowedStatuses.includes(status)) {

    return res.status(400).json({

      success: false,

      message: "Geçersiz sipariş durumu."

    });

  }



  try {

    const result = await pool.query(

      "UPDATE orders SET status=$1 WHERE id=$2 RETURNING id, status",

      [status, req.params.id]

    );



    if (!result.rowCount) {

      return res.status(404).json({

        success: false,

        message: "Sipariş bulunamadı."

      });

    }



    res.json({

      success: true,

      order: result.rows[0],

      message: "Sipariş durumu güncellendi."

    });

  } catch (error) {

    console.error("Sipariş durumu güncelleme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Sipariş durumu güncellenemedi."

    });

  }

});



// KARGO TAKİP BİLGİLERİNİ KAYDET



app.patch("/api/admin/orders/:id/shipping", adminAuth, async (req, res) => {

  if (!/^\d+$/.test(req.params.id)) {

    return res.status(400).json({

      success: false,

      message: "Geçersiz sipariş numarası."

    });

  }



  const body = req.body || {};



  const company =

    typeof body.shipping_company === "string"

      ? body.shipping_company.trim()

      : "";



  const trackingNumber =

    typeof body.tracking_number === "string"

      ? body.tracking_number.trim()

      : "";



  const trackingUrl =

    typeof body.tracking_url === "string"

      ? body.tracking_url.trim()

      : "";



  if (

    company.length > 100 ||

    trackingNumber.length > 100 ||

    trackingUrl.length > 500

  ) {

    return res.status(400).json({

      success: false,

      message: "Kargo alanlarından biri çok uzun."

    });

  }



  if (trackingUrl) {

    try {

      const parsed = new URL(trackingUrl);



      if (!["http:", "https:"].includes(parsed.protocol)) {

        throw new Error("Geçersiz bağlantı protokolü.");

      }

    } catch {

      return res.status(400).json({

        success: false,

        message: "Takip bağlantısı http:// veya https\:// ile başlamalı."

      });

    }

  }



  try {

    const result = await pool.query(

      `UPDATE orders

       SET shipping_company = $1,

           tracking_number = $2,

           tracking_url = $3

       WHERE id = $4

       RETURNING id, shipping_company, tracking_number, tracking_url`,

      [

        company || null,

        trackingNumber || null,

        trackingUrl || null,

        req.params.id

      ]

    );



    if (!result.rowCount) {

      return res.status(404).json({

        success: false,

        message: "Sipariş bulunamadı."

      });

    }



    res.json({

      success: true,

      order: result.rows[0],

      message: "Kargo bilgileri kaydedildi."

    });

  } catch (error) {

    console.error("Kargo bilgisi kaydetme hatası:", error.message);

    res.status(500).json({

      success: false,

      message: "Kargo bilgileri kaydedilemedi."

    });

  }

});



// SAYFA ADRESLERİ



app.get("/", (req, res) => {

  res.sendFile(path.join(OKUL_DIR, "anasayfa.html"));

});



app.get("/admin", (req, res) => {

  res.sendFile(path.join(OKUL_DIR, "admin.html"));

});



// VERİTABANI TABLOLARINI HAZIRLA



async function initializeDatabase() {

  await pool.query(`

    CREATE TABLE IF NOT EXISTS products (

      id SERIAL PRIMARY KEY,

      name VARCHAR(250) NOT NULL,

      description TEXT NOT NULL,

      price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),

      image VARCHAR(500) NOT NULL,

      category VARCHAR(100) NOT NULL,

      created_at TIMESTAMPTZ DEFAULT NOW()

    )

  `);



    await pool.query(`

    CREATE TABLE IF NOT EXISTS customers (

      id BIGSERIAL PRIMARY KEY,

      name VARCHAR(150) NOT NULL,

      email VARCHAR(254) NOT NULL UNIQUE,

      password_hash TEXT NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

    )

  `);



  await pool.query(`

    CREATE TABLE IF NOT EXISTS orders (

      id BIGSERIAL PRIMARY KEY,

      customer_name VARCHAR(150) NOT NULL,

      email VARCHAR(254) NOT NULL,

      phone VARCHAR(30) NOT NULL,

      address VARCHAR(1000) NOT NULL,

      total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),

      status VARCHAR(50) NOT NULL DEFAULT 'Ödeme bekleniyor',

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

    )

  `);



  await pool.query(`

    CREATE TABLE IF NOT EXISTS order_items (

      id BIGSERIAL PRIMARY KEY,

      order_id BIGINT NOT NULL

        REFERENCES orders(id) ON DELETE CASCADE,

      product_id INTEGER NOT NULL REFERENCES products(id),

      product_name VARCHAR(250) NOT NULL,

      quantity INTEGER NOT NULL CHECK (quantity > 0),

      unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)

    )

  `);



  // Yeni stok sütunu: mevcut ürünler 0 stokla başlar; yönetici gerçek miktarı girer.

  await pool.query(`

    ALTER TABLE products

      ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)

  `);



  // Mevcut veritabanına kargo sütunlarını ekle.

  // Var olan siparişler veya ürünler silinmez.

  await pool.query(`

    ALTER TABLE orders

      ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(100),

      ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),

      ADD COLUMN IF NOT EXISTS tracking_url VARCHAR(500),

      ADD COLUMN IF NOT EXISTS tracking_code_hash VARCHAR(64)

  `);



  const countResult = await pool.query(

    "SELECT COUNT(*)::int AS total FROM products"

  );



  if (countResult.rows[0].total === 0) {

    const products = [

      {

        name: "GIGABYTE GAMING A16 Laptop",

        description: "GIGABYTE GAMING A16 Ryzen 7 260, 16GB DDR5, RTX 5060, 16 inç FHD 165Hz Gaming Notebook",

        price: 67000,

        image: "ürünlerresim/laptopcard.png",

        category: "Laptop"

      },

      {

        name: "MSI RTX 5060 Ti Ekran Kartı",

        description: "MSI GeForce RTX 5060 Ti SHADOW 2X OC PLUS 8GB GDDR7, DLSS 4, 128 Bit ekran kartı",

        price: 25000,

        image: "ürünlerresim/ekrankartıcard.png",

        category: "Ekran Kartı"

      },

      {

        name: "Logitech G515 TKL Klavye",

        description: "Logitech G515 TKL RGB mekanik siyah kablolu gaming klavye",

        price: 5700,

        image: "ürünlerresim/klavyecard.png",

        category: "Klavye"

      },

      {

        name: "A4Tech Bloody R73 Mouse",

        description: "A4Tech Bloody R73 ULTRA 20000 CPI siyah kablosuz gaming mouse",

        price: 2600,

        image: "ürünlerresim/mausecard.png",

        category: "Mouse"

      }

    ];



    for (const product of products) {

      await pool.query(

        `INSERT INTO products (name, description, price, image, category)

         VALUES ($1, $2, $3, $4, $5)`,

        [

          product.name,

          product.description,

          product.price,

          product.image,

          product.category

        ]

      );

    }



    console.log("İlk ürünler veritabanına eklendi.");

  }

}



// DESTEK TALEPLERİ
app.post("/api/support", async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const email = String(req.body.email || "").trim();
    const phone = String(req.body.phone || "").trim();
    const message = String(req.body.message || "").trim();
    if (!fullName || !email || !message) {
      return res.status(400).json({ success: false, message: "Ad Soyad, e-posta ve mesaj zorunludur." });
    }
    if (fullName.length > 200 || email.length > 254 || phone.length > 40 || message.length > 10000) {
      return res.status(400).json({ success: false, message: "Form alanlarından biri izin verilen uzunluğu aşıyor." });
    }
    const result = await pool.query(
      `INSERT INTO support_requests (full_name, email, phone, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [fullName, email, phone, message]
    );
    res.status(201).json({ success: true, message: "Destek talebiniz alındı.", request: result.rows[0] });
  } catch (error) {
    console.error("Destek talebi kaydedilemedi:", error);
    res.status(500).json({ success: false, message: "Talep kaydedilemedi. Lütfen tekrar deneyin." });
  }
});

app.get("/api/admin/support", adminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, message, status, admin_response, created_at, updated_at
       FROM support_requests ORDER BY created_at DESC LIMIT 500`
    );
    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error("Destek talepleri alınamadı:", error);
    res.status(500).json({ success: false, message: "Destek talepleri alınamadı." });
  }
});

app.get("/api/admin/support/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Geçersiz talep numarası." });
  try {
    const result = await pool.query("SELECT * FROM support_requests WHERE id = $1", [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Talep bulunamadı." });
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Talep alınamadı." });
  }
});

app.put("/api/admin/support/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ["Yeni", "İnceleniyor", "Yanıtlandı", "Kapatıldı"];
  const status = String(req.body.status || "Yeni").trim();
  const response = String(req.body.admin_response || "").trim();

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Geçersiz talep numarası." });
  }
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Geçersiz talep durumu." });
  }
  if (response.length > 10000) {
    return res.status(400).json({ success: false, message: "Yanıt çok uzun." });
  }

  try {
    const customerResult = await pool.query(
      "SELECT full_name, email FROM support_requests WHERE id = $1",
      [id]
    );

    if (!customerResult.rowCount) {
      return res.status(404).json({ success: false, message: "Talep bulunamadı." });
    }

    const customer = customerResult.rows[0];

    const result = await pool.query(
      `UPDATE support_requests
       SET status = $1, admin_response = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, status, admin_response, updated_at`,
      [status, response, id]
    );

    let emailSent = false;

    if (response && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 465),
          secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: customer.email,
          subject: "Destek talebinize yanıt verildi",
          text:
            "Merhaba " + customer.full_name + ",\n\n" +
            "Destek talebinize yanıt verildi:\n\n" +
            response + "\n\n" +
            "Bilgisayar Sitesi Destek Ekibi"
        });

        emailSent = true;
      } catch (mailError) {
        console.error("Destek yanıtı e-postası gönderilemedi:", mailError.message);
      }
    }

    res.json({
      success: true,
      request: result.rows[0],
      emailSent,
      emailMessage: emailSent
        ? "Yanıt kaydedildi ve e-posta gönderildi."
        : "Yanıt kaydedildi; e-posta gönderilemedi veya e-posta ayarları eksik."
    });
  } catch (error) {
    console.error("Destek talebi güncellenemedi:", error);
    res.status(500).json({
      success: false,
      message: "Talep güncellenemedi."
    });
  }
});
app.delete("/api/admin/support/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Geçersiz talep numarası." });
  try {
    const result = await pool.query("DELETE FROM support_requests WHERE id = $1 RETURNING id", [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Talep bulunamadı." });
    res.json({ success: true, message: "Talep silindi." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Talep silinemedi." });
  }
});



// SUNUCUYU BAŞLAT



async function startServer() {

  try {

    await initializeDatabase();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_requests (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(200) NOT NULL,
        email VARCHAR(254) NOT NULL,
        phone VARCHAR(40) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Yeni',
        admin_response TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);



    app.listen(PORT, () => {

      console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);

    });

  } catch (error) {

    console.error("Sunucu başlatılamadı:", error.message);

    process.exit(1);

  }

}



startServer();
