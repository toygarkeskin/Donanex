"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { PERMISSIONS } = require("../domain/identity/Permission");
const { SYSTEM_ROLES, RoleCodes } = require("../domain/identity/Role");
const { assertPasswordStrength } = require("../domain/identity/User");

const VAR_DIR = path.resolve(__dirname, "../../var");

/**
 * Rol ve izin kataloğunu domain'den veritabanına yansıtır.
 *
 * Tek doğru kaynak domain/identity altındaki sabitlerdir; veritabanı yalnızca
 * onun bir kopyasıdır. Yeni bir izin eklendiğinde burada kendiliğinden oluşur,
 * kaldırıldığında rollerden düşer.
 */
async function syncRolesAndPermissions(unitOfWork, logger) {
  await unitOfWork.run(async ({ users }) => {
    const db = users.db;

    for (const [code, meta] of Object.entries(PERMISSIONS)) {
      await db.query(
        `INSERT INTO permissions (code, label, scope) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, scope = EXCLUDED.scope`,
        [code, meta.label, meta.scope]
      );
    }
    await db.query("DELETE FROM permissions WHERE code <> ALL($1::varchar[])", [Object.keys(PERMISSIONS)]);

    for (const role of SYSTEM_ROLES) {
      await db.query(
        `INSERT INTO roles (code, name, description, scope, is_system) VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, scope = EXCLUDED.scope`,
        [role.code, role.name, role.description, role.scope]
      );
      await db.query("DELETE FROM role_permissions WHERE role_code = $1", [role.code]);
      for (const permission of role.permissions) {
        await db.query(
          "INSERT INTO role_permissions (role_code, permission_code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [role.code, permission]
        );
      }
    }
  });

  logger.info("{Roles} rol ve {Permissions} izin eşitlendi", {
    Roles: SYSTEM_ROLES.length,
    Permissions: Object.keys(PERMISSIONS).length
  });
}

/**
 * İlk kurulumda sistem yöneticisini oluşturur.
 *
 * Parola verilmemişse güçlü bir parola ÜRETİLİR ve iki yere yazılır:
 * günlüğe (bir kez, açıkça) ve /app/var/bootstrap-admin.txt dosyasına.
 * Parola veritabanında yalnızca scrypt özeti olarak durur.
 *
 * Yönetici zaten varsa hiçbir şey yapılmaz; bu fonksiyon her açılışta
 * güvenle çağrılabilir.
 */
async function ensureSystemAdmin({ unitOfWork, passwordHasher, ids, config, logger }) {
  const existing = await unitOfWork.run(({ roles }) => roles.countByCode(RoleCodes.SYSTEM_ADMIN));
  if (existing > 0) {
    logger.info("Sistem yöneticisi mevcut ({Count} adet), yeni hesap oluşturulmadı", { Count: existing });
    return null;
  }

  // Üretilen parola: 24 bayt, URL güvenli, harf+rakam kuralını karşılar.
  const generated = !config.bootstrapAdmin.password;
  const password = generated
    ? `Pz${crypto.randomBytes(18).toString("base64url")}9`
    : config.bootstrapAdmin.password;
  assertPasswordStrength(password);

  const email = config.bootstrapAdmin.email;
  const passwordHash = await passwordHasher.hash(password);

  const created = await unitOfWork.run(async (repos) => {
    const user = await repos.users.createIfEmailFree({
      id: ids.uuid(),
      email,
      fullName: "Sistem Yöneticisi",
      phone: null,
      passwordHash
    });
    if (!user) {
      // E-posta zaten kayıtlı: o hesaba yönetici rolü ver.
      const found = await repos.users.findCredentialsByEmail(email);
      await repos.roles.assign({ userId: found.id, roleCode: RoleCodes.SYSTEM_ADMIN, storeId: null });
      return { ...found, roleOnly: true };
    }
    await repos.users.markEmailVerified(user.id);
    await repos.roles.assign({ userId: user.id, roleCode: RoleCodes.SYSTEM_ADMIN, storeId: null });
    await repos.roles.assign({ userId: user.id, roleCode: RoleCodes.CUSTOMER, storeId: null });
    return user;
  });

  if (created.roleOnly) {
    logger.warn("{Email} zaten kayıtlıydı; bu hesaba sistem yöneticisi rolü verildi", { Email: email });
    return null;
  }

  const credentials = { email, password, generated };
  announce(credentials, logger);
  return credentials;
}

/** Parolayı günlüğe ve kalıcı bir dosyaya yazar. */
function announce({ email, password, generated }, logger) {
  const banner = [
    "",
    "=".repeat(68),
    "  SİSTEM YÖNETİCİSİ OLUŞTURULDU",
    "=".repeat(68),
    `  E-posta : ${email}`,
    `  Parola  : ${password}`,
    "",
    generated
      ? "  Bu parola rastgele üretildi ve bir daha GÖSTERİLMEYECEK."
      : "  Parola BOOTSTRAP_ADMIN_PASSWORD değerinden alındı.",
    "  İlk girişten sonra değiştirin.",
    "=".repeat(68),
    ""
  ].join("\n");

  console.log(banner);
  logger.warn("Sistem yöneticisi oluşturuldu: {Email} (parola konsola ve dosyaya yazıldı)", { Email: email });

  try {
    fs.mkdirSync(VAR_DIR, { recursive: true });
    const file = path.join(VAR_DIR, "bootstrap-admin.txt");
    fs.writeFileSync(
      file,
      `Pazar — ilk kurulum yönetici bilgileri\nOluşturulma: ${new Date().toISOString()}\n\nE-posta: ${email}\nParola : ${password}\n\nBu dosyayı güvenli bir yere taşıyıp silin.\n`,
      { mode: 0o600 }
    );
    console.log(`  (Aynı bilgi şu dosyaya da yazıldı: ${file})\n`);
  } catch (error) {
    logger.warn("Yönetici bilgileri dosyaya yazılamadı: {Reason}", { Reason: error.message });
  }
}

module.exports = { syncRolesAndPermissions, ensureSystemAdmin };
