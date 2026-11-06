"use strict";

/**
 * Sunum katmanının kullanım senaryosu sonuçlarından OKUDUĞU alanlar.
 *
 * CommandBus/QueryBus bir kayıt tablosu üzerinden çalışır, bu yüzden mesaj
 * tipinden sonucu kendisi çıkaramaz; sonuç `unknown` gelir. Rotalar da çoğu
 * zaman sonuca bakmaz, olduğu gibi yanıta geçirip yanına bir mesaj ekler.
 *
 * Buradaki tipler yalnızca rotanın GERÇEKTEN alan okuduğu yerler için vardır.
 * Böylece "handler bu alanı döndürüyor" varsayımı kodda yazılı hale gelir:
 * handler bir alanın adını değiştirirse, derleme bu dosyayı güncellemeye
 * zorlar — hata, o uç çağrılana kadar beklemez.
 *
 * Tam tipli bir alternatif, her mesajı sonucuna bağlayan jenerik bir bus
 * olurdu; bu, kayıt tablosu yaklaşımından vazgeçmek demek. Şimdilik bilinçli
 * olarak bu sınırda duruyoruz ve sınırı burada yazıyoruz.
 */

/** Olduğu gibi yanıta geçirilen sonuç: rota alanlarına bakmaz, yalnızca yayar. */
export type Sonuc = Record<string, unknown>;

/* ---------------- kimlik ---------------- */

export interface SignInResult extends Sonuc {
  readonly user: { readonly id: string };
  readonly session: {
    readonly token: string;
    readonly maxAgeSeconds: number;
    readonly sessionId: string;
  };
  /** Misafir sepetinden kullanıcıya taşınan satır sayısı. */
  readonly mergedCartItems: number;
}

export interface CompleteAuthorizationResult extends Sonuc {
  readonly redirectTo: string | null;
}

export interface ChangePasswordResult extends Sonuc {
  /** Parola değişince yeni oturum kurulur; eski jetonlar düşer. */
  readonly session: { readonly token: string; readonly maxAgeSeconds: number };
}

export interface CurrentUserResult extends Sonuc {
  readonly fullName: string | null;
  readonly email: string | null;
  readonly emailVerified: boolean;
}

/* ---------------- OAuth ---------------- */

export interface AuthorizeResult extends Sonuc {
  /** Oturum varsa kod ile istemciye, yoksa arayüzün giriş sayfasına. */
  readonly redirectTo: string;
}

/**
 * Jeton ucunun yaniti. Alanlar RFC 6749 adlandırmasını kullanır (snake_case).
 *
 * readonly DEĞİL: refresh_token tarayıcıya çerezle verilir ve gövdeden
 * SİLİNİR; silme işlemi nesneyi değiştirir.
 */
export interface TokenResult {
  refresh_token?: string;
  [field: string]: unknown;
}

/* ---------------- sepet ---------------- */

export interface CartMutationResult extends Sonuc {
  readonly cartId: string | null;
  readonly isGuestCart: boolean;
}

/* ---------------- yönetim ve mağaza ---------------- */

export interface RoleAssignmentResult extends Sonuc {
  readonly revoked: boolean;
}

export interface StoreMemberResult extends Sonuc {
  readonly removed: boolean;
}

export interface ProductImportResult extends Sonuc {
  readonly count: number;
}

export interface ProductDeleteResult extends Sonuc {
  /** Geçmiş siparişlerde geçen ürün silinmez, arşive alınır. */
  readonly archived: boolean;
}

export interface TicketResult extends Sonuc {
  readonly id: string;
  readonly reference: string;
}

/* ---------------- sistem ---------------- */

export interface ReadinessResult extends Sonuc {
  readonly ready: boolean;
}
