/*
 * Girişte e-posta doğrulama kodu.
 *
 * Parola doğruysa oturum hemen açılmıyor: e-postaya 6 haneli kod gidiyor,
 * oturum kod girilince açılıyor. Kod kısa (10^6 olasılık) olduğu için
 * deneme sayısı SAYILIYOR — 5 yanlıştan sonra kod ölüyor; süre 10 dakika.
 *
 * Kodun kendisi saklanmıyor, yalnızca HMAC özeti (anahtar sunucuda).
 * Özete kodun kimliği de karışıyor: aynı kod iki farklı girişte farklı özet
 * veriyor.
 */
CREATE TABLE IF NOT EXISTS login_challenges (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash    VARCHAR(64) NOT NULL,
  attempts     SMALLINT NOT NULL DEFAULT 0,
  sends        SMALLINT NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_challenges_user ON login_challenges (user_id);

/*
 * "Bu cihazı hatırla": kod bir kez doğrulanınca tarayıcıya HttpOnly çerezle
 * rastgele bir jeton veriliyor; o tarayıcıda 30 gün kod sorulmuyor (parola
 * yine soruluyor). Parola değişince ya da hesap askıya alınınca hepsi
 * siliniyor.
 */
CREATE TABLE IF NOT EXISTS trusted_devices (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices (user_id);
