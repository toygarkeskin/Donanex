"use strict";

/**
 * Port arayüzleri — application katmanının dış dünyadan beklediği şekiller.
 *
 * ports.ts ÇALIŞMA ZAMANINDA doğrular (metot var mı), bu dosya DERLEMEDE
 * doğrular (doğru adla, doğru argümanlarla çağrılıyor mu ve gerçekten bir
 * şey döndürüyor mu). İkisi birlikte çalışır.
 *
 * İmzalar tahminle değil, infrastructure'daki gerçek sınıflardan çıkarıldı ve
 * her biri "implements" ile bağlandı; adaptör sözleşmeden saparsa derleme durur.
 *
 * Satır şekilleri hakkında dürüst sınır: sorgu sonuçları "Row" ile geçiyor.
 * Metot adları, argümanlar ve DÖNÜŞ OLUP OLMADIĞI tam tipli; satırın içindeki
 * alan adları henüz denetlenmiyor.
 */

import type { RoleAssignment as RoleAssignmentRow } from "../../domain/identity/AccessPolicy";
import type { DomainEventShape } from "../../domain/shared/DomainEvent";
import type { CartLine } from "../../domain/ordering/Cart";

/** Veritabanı satırı. */
export type Row = Record<string, any>;

/**
 * Sayfalama alanları.
 *
 * Sorgu işleyicileri bu dördünü HER ZAMAN hesaplayıp geçirir: limit/offset
 * SQL'e, page/pageSize yanıttaki sayfa bilgisine gider. Row'un indeks imzası
 * "bu alanlar olabilir" der, bu arayüz "olmak zorunda" der — read model'ler
 * sayfalamayı kendileri uydurmasın diye ayrı tutuluyor.
 */
export interface Paging {
  readonly limit: number;
  readonly offset: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Liste sorgusu girdisi: serbest filtreler + zorunlu sayfalama. */
export type ListFilters = Row & Paging;

/* ---------------------------------------------------------------- */
/* Yazma tarafı: repository'ler ve transaction sınırı                 */
/* ---------------------------------------------------------------- */

export interface UserRepository {
  createIfEmailFree(input: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<Row | null>;
  findCredentialsByEmail(email: string): Promise<Row | null>;
  findById(id: string): Promise<Row | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  /** Oturum sürümünü artırır ve yeni değerini döndürür; eski jetonlar düşer. */
  changePassword(id: string, passwordHash: string): Promise<number | null>;
  updateProfile(id: string, input: { fullName: string; phone: string | null }): Promise<void>;
  markEmailVerified(id: string): Promise<void>;
  setStatus(id: string, status: string): Promise<void>;
  touchLastLogin(id: string): Promise<void>;
  addAddress(userId: string, address: Row): Promise<Row>;
  updateAddress(userId: string, addressId: string, address: Row): Promise<Row | null>;
  removeAddress(userId: string, addressId: string): Promise<boolean>;
}

export interface RoleRepository {
  findByCode(code: string): Promise<Row | null>;
  assign(input: { userId: string; roleCode: string; storeId?: string | null }): Promise<void>;
  revoke(input: { userId: string; roleCode: string; storeId?: string | null }): Promise<boolean>;
  /** roleCode + storeId + permissions döndürür; AccessPolicy doğrudan bunu alır. */
  listForUser(userId: string): Promise<RoleAssignmentRow[]>;
  countByCode(roleCode: string): Promise<number>;
  hasRole(userId: string, roleCode: string): Promise<boolean>;
}

export interface AuthSessionRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<Row>;
  findByTokenHash(tokenHash: string): Promise<Row | null>;
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<Row | null>;
  findActiveById(id: string | null, now: Date): Promise<Row | null>;
  revoke(id: string | null): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  purgeExpired(): Promise<void>;
}

export interface OAuthRepository {
  findClient(clientId: string): Promise<Row | null>;
  saveAuthorizationCode(code: Row): Promise<void>;
  /** Kodu TÜKETİR: tek kullanımlıktır ve doğrulamadan ÖNCE yakılır. */
  consumeAuthorizationCode(codeHash: string, now: Date): Promise<Row | null>;
  saveRefreshToken(token: Row): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<Row | null>;
  markRefreshTokenUsed(id: string, now: Date): Promise<void>;
  /** Çalınan jeton tespitinde tüm aileyi iptal eder. */
  revokeRefreshTokenFamily(familyId: string): Promise<void>;
  revokeRefreshTokensForUser(userId: string): Promise<void>;
  revokeRefreshTokensForSession(sessionId: string | null): Promise<void>;
  upsertClient(client: Row): Promise<void>;
  purgeExpired(): Promise<void>;
}

export interface VerificationTokenRepository {
  replace(input: { purpose: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  consume(purpose: string, tokenHash: string, now: Date): Promise<Row | null>;
  purgeExpired(): Promise<void>;
}

export interface StoreRepository {
  create(store: Row): Promise<Row>;
  findById(id: string): Promise<Row | null>;
  exists(id: string): Promise<boolean>;
  slugExists(slug: string): Promise<boolean>;
  hasPendingApplication(userId: string): Promise<boolean>;
  update(id: string, data: Row): Promise<Row | null>;
  setStatus(id: string, status: string): Promise<Row | null>;
}

export interface ProductRepository {
  reserveSlug(storeId: string, desired: string): Promise<string>;
  create(product: Row): Promise<Row>;
  createMany(products: readonly Row[]): Promise<number>;
  update(storeId: string, product: Row): Promise<Row | null>;
  setStatus(storeId: string, productId: string, status: string): Promise<Row | null>;
  remove(storeId: string, productId: string): Promise<boolean>;
  isReferencedByOrders(productId: string): Promise<boolean>;
  findPurchasable(productId: string): Promise<Row | null>;
  /**
   * SELECT … FOR UPDATE: eş zamanlı siparişlerde fazla satışı engeller.
   * Dizi değil MAP döndürür (ürün numarası -> satır).
   */
  lockForOrder(productIds: readonly string[]): Promise<Map<string, Row>>;
  decreaseStock(productId: string, quantity: number): Promise<void>;
  increaseStock(productId: string, quantity: number): Promise<void>;
}

export interface CategoryRepository {
  create(input: { id: string; name: string; slug: string; parentId: string | null }): Promise<Row | null>;
  findBySlug(slug: string): Promise<Row | null>;
}

export interface CartRepository {
  findById(id: string | null): Promise<Row | null>;
  findByUser(userId: string): Promise<Row | null>;
  findOrCreateForUser(userId: string): Promise<Row>;
  createGuestCart(): Promise<Row>;
  listLines(cartId: string): Promise<CartLine[]>;
  setLine(cartId: string, productId: string, quantity: number): Promise<Row | null>;
  removeLine(cartId: string, productId: string): Promise<void>;
  replaceLines(cartId: string, lines: readonly CartLine[]): Promise<void>;
  remove(cartId: string): Promise<void>;
  markConverted(cartId: string, orderId: string): Promise<void>;
  touch(cartId: string): Promise<void>;
  purgeAbandonedGuestCarts(before: Date): Promise<number>;
}

export interface OrderRepository {
  nextOrderNumber(): Promise<string>;
  create(order: Row): Promise<Row>;
  findById(id: string): Promise<Row | null>;
  lockForUser(orderId: string, userId: string | null): Promise<Row | null>;
  lockForPayment(input: {
    orderId: string;
    userId?: string | null;
    trackingCodeHash?: string | null;
  }): Promise<Row | null>;
  lockUnpaidOlderThan(cutoff: Date, limit: number): Promise<Row[]>;
  listPackages(orderId: string): Promise<Row[]>;
  listPackageStatuses(orderId: string): Promise<string[]>;
  listPackageItems(packageId: string): Promise<Row[]>;
  lockPackageForStore(packageId: string, storeId: string): Promise<Row | null>;
  setStatus(orderId: string, status: string): Promise<Row | null>;
  setPackageStatus(packageId: string, status: string): Promise<Row | null>;
  /** Stoğun yalnızca BİR KEZ iade edilmesini sağlar. */
  markPackageStockReleased(packageId: string): Promise<void>;
  setPackageShipping(packageId: string, storeId: string, shipping: Row): Promise<Row | null>;
  recordPayment(payment: Row): Promise<void>;
}

export interface SupportRepository {
  createTicket(ticket: Row): Promise<Row>;
  findTicket(ticketId: string, storeId?: string | null): Promise<Row | null>;
  addMessage(input: {
    id: string;
    ticketId: string;
    authorUserId: string | null;
    body: string;
    isStaff: boolean;
  }): Promise<void>;
  setTicketStatus(ticketId: string, status: string): Promise<Row | null>;
}

export interface OutboxRepository {
  /** Olay, onu doğuran veriyle AYNI transaction'da yazılır. */
  add(event: DomainEventShape): Promise<void>;
  claimPending(limit: number): Promise<Row[]>;
  markPublished(ids: readonly (string | number)[]): Promise<void>;
  markFailed(id: string | number, error: unknown): Promise<void>;
}

export interface AuditRepository {
  record(input: {
    actorId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Row;
    context?: Row;
  }): Promise<void>;
}

/**
 * Transaction'ın ham bağlantısı.
 *
 * Yalnızca toplu SQL çalıştırmaya yeter; pg tipleri burada geçmez, böylece
 * application katmanı hangi veritabanını kullandığımızı bilmemeye devam eder.
 */
export interface TransactionClient {
  query(sql: string, params?: readonly unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
}

/** Tek transaction içinde verilen repository seti. */
export interface Repositories {
  /**
   * Açık transaction'ın bağlantısı — KURULUM İŞLERİ İÇİN kaçış kapısı.
   *
   * Rol/izin kataloğunu domain'den veritabanına yansıtmak ya da demo veri
   * kurmak gibi tek seferlik toplu SQL'ler için var; her biri için repository
   * metodu açmak sözleşmeyi şişirirdi.
   *
   * Daha önce bu erişim `users.db` / `stores.db` üzerinden alınıyordu: hangi
   * repository'nin alanını açtığı tesadüfe kalmış, gizli bir bağımlılıktı.
   * Burada adı konuldu ki kullanımı görünür olsun — uygulama katmanının
   * komut ve sorgu handler'ları bunu KULLANMAZ.
   */
  readonly db: TransactionClient;
  readonly users: UserRepository;
  readonly roles: RoleRepository;
  readonly authSessions: AuthSessionRepository;
  readonly oauth: OAuthRepository;
  readonly verificationTokens: VerificationTokenRepository;
  readonly stores: StoreRepository;
  readonly products: ProductRepository;
  readonly categories: CategoryRepository;
  readonly carts: CartRepository;
  readonly orders: OrderRepository;
  readonly support: SupportRepository;
  readonly outbox: OutboxRepository;
  readonly audit: AuditRepository;
}

/**
 * Transaction sınırı.
 *
 * Açık transaction AsyncLocalStorage'da tutulur: iç içe run() çağrıları aynı
 * transaction'ı paylaşır, farklı istekler ASLA paylaşmaz.
 */
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

/* ---------------------------------------------------------------- */
/* Okuma tarafı: read model'ler                                       */
/* ---------------------------------------------------------------- */

export interface CatalogReadModel {
  listProducts(filters: ListFilters): Promise<Row>;
  getProductBySlug(storeSlug: string, productSlug: string): Promise<Row | null>;
  listCategories(): Promise<Row[]>;
  listStoreProducts(storeId: string, filters: ListFilters): Promise<Row>;
  getProductForStore(storeId: string, productId: string): Promise<Row | null>;
  listBrands(): Promise<Row[]>;
  getBrandBySlug(slug: string): Promise<Row | null>;
  listBrandStores(brandId: string): Promise<Row[]>;
}

export interface StoreReadModel {
  getBySlug(slug: string): Promise<Row | null>;
  listPublic(filters: Row): Promise<Row[]>;
  listForAdmin(filters: ListFilters): Promise<Row>;
  getForMember(storeId: string): Promise<Row | null>;
  listMembers(storeId: string): Promise<Row[]>;
  /** Mağaza KİMLİKLERİ alır (kullanıcı değil): panel menüsü için. */
  listForMember(storeIds: readonly string[]): Promise<Row[]>;
}

export interface CartProductRow extends Row {
  readonly id: string;
  readonly priceCents: number;
}

export interface CartReadModel {
  /** Satırlar ve güncel ürün bilgisi birlikte döner; dizi değil nesne. */
  getLines(cartId: string): Promise<{ lines: CartLine[]; products: CartProductRow[] }>;
  findCartId(input: { userId?: string | null; guestCartId?: string | null }): Promise<string | null>;
}

export interface OrderReadModel {
  listForUser(userId: string, filters: ListFilters): Promise<Row>;
  getForUser(orderId: string, userId: string): Promise<Row | null>;
  getByTrackingCode(orderNumber: string, trackingCodeHash: string): Promise<Row | null>;
  listForStore(storeId: string, filters: ListFilters): Promise<Row>;
  /** Sıra: önce PAKET, sonra mağaza. */
  getForStore(packageId: string, storeId: string): Promise<Row | null>;
  listForAdmin(filters: ListFilters): Promise<Row>;
  getForAdmin(orderId: string): Promise<Row | null>;
}

export interface UserReadModel {
  getProfile(userId: string): Promise<Row | null>;
  listForAdmin(filters: ListFilters): Promise<Row>;
  /** Ham rol atamalarını döndürür; AccessPolicy nesnesini çağıran kurar. */
  getAccessPolicy(userId: string): Promise<RoleAssignmentRow[]>;
  getSessionVersion(userId: string): Promise<number | null>;
  listAddresses(userId: string): Promise<Row[]>;
}

export interface SupportReadModel {
  listForUser(userId: string, filters: ListFilters): Promise<Row>;
  listForStore(storeId: string, filters: ListFilters): Promise<Row>;
  listForAdmin(filters: ListFilters): Promise<Row>;
  get(ticketId: string, scope: Row): Promise<Row | null>;
}

export interface DashboardReadModel {
  adminSummary(): Promise<Row>;
  storeSummary(storeId: string): Promise<Row>;
}

export interface HealthReadModel {
  ping(): Promise<unknown>;
}

/* ---------------------------------------------------------------- */
/* Güvenlik ve altyapı servisleri                                     */
/* ---------------------------------------------------------------- */

/**
 * JWT üretimi ve doğrulaması.
 *
 * issue* metotları imzalı jetonun KENDİSİNİ (string) döndürür, nesne değil.
 * verifyAccessToken geçersiz jetonda fırlatmaz, null döner: çağıran "geçersiz"
 * durumunu olağan bir akış olarak ele alır.
 */
export interface TokenIssuer {
  issueAccessToken(input: Row): Promise<string>;
  issueIdToken(input: Row): Promise<string>;
  verifyAccessToken(token: unknown, options?: { audience?: string | null }): Promise<Row | null>;
  jwks(): Row;
}

export interface OpaqueTokens {
  generate(): string;
  hash(token: unknown): string;
  /** Tip daraltıcı: geçen değer çağıran tarafta artık string olarak bilinir. */
  isWellFormed(token: unknown): token is string;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /**
   * stored unknown: veritabanindaki ozet bozuk, eksik ya da eski bicimde
   * olabilir. Uygulama bunu zaten ele aliyor; imza da bunu soyluyor ki
   * cagiran "yukarida dogrulanmistir" varsayimina kapilmasin.
   */
  verify(password: string, stored: unknown): Promise<boolean>;
  /**
   * Kullanıcı yokken de aynı süreyi harcar: zamanlama sızıntısını kapatır.
   * Her zaman false döner; verilen parolayı da özetler ki süre eşleşsin.
   */
  verifyDummy(password?: unknown): Promise<false>;
  needsRehash(stored: unknown): boolean;
}

export interface Pkce {
  /** Sıra önemli: önce doğrulayıcı, sonra saklanan meydan okuma. */
  verify(verifier: unknown, challenge: unknown): boolean;
  challengeFor(verifier: string): string;
}

/**
 * Önbellek.
 *
 * ttlSeconds ZORUNLU: süresiz önbellek girdisi, veri değiştiğinde sessizce
 * eskimiş yanıt döndürmenin en kolay yoludur. Her çağıran ömrünü bilinçli
 * seçmek durumunda.
 */
export interface Cache {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

/**
 * E-posta gönderimi.
 *
 * Gönderim başarısız olursa FIRLATMAZ, false döner: kayıt ya da sipariş akışı
 * posta sunucusu yüzünden yarıda kalmasın. Sonucu önemseyen çağıran denetler.
 */
export interface Mailer {
  send(message: Row): Promise<boolean>;
}

export interface FileStorage {
  save(content: Buffer): Promise<{ fileName: string; contentType: string; size: number }>;
  read(fileName: string): Promise<{ content: Buffer; contentType: string }>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

export type { Logger } from "./cqrs/logging";

import type { Logger as LoggerPort } from "./cqrs/logging";

/* ---------------------------------------------------------------- */
/* Composition root'un ürettiği servis torbası                        */
/* ---------------------------------------------------------------- */

/**
 * Handler'lara verilen bağlı portlar.
 *
 * ports.ts'teki PORTS listesinin derleme zamanı karşılığıdır: orası açılışta
 * "bu metot var mı" diye bakar, burası daha önce — kodu yazarken — bakar.
 * İkisi birlikte tutulmalı; bir port eklenirse hem PORTS'a hem buraya girer.
 *
 * Somut sınıfların hiçbiri burada adı geçmez: application katmanı hangi
 * veritabanını ya da kuyruğu kullandığımızı bilmemeye devam eder.
 */
export interface Services {
  /* yazma tarafı */
  readonly unitOfWork: UnitOfWork;

  /* okuma tarafı */
  readonly catalogReadModel: CatalogReadModel;
  readonly storeReadModel: StoreReadModel;
  readonly cartReadModel: CartReadModel;
  readonly orderReadModel: OrderReadModel;
  readonly userReadModel: UserReadModel;
  readonly supportReadModel: SupportReadModel;
  readonly dashboardReadModel: DashboardReadModel;
  readonly healthReadModel: HealthReadModel;

  /* güvenlik */
  readonly tokenIssuer: TokenIssuer;
  readonly opaqueTokens: OpaqueTokens;
  readonly passwordHasher: PasswordHasher;
  readonly pkce: Pkce;
  /** Sabit süreli karşılaştırma; jeton eşlemede kullanılır. */
  readonly safeEqual: (a: unknown, b: unknown) => boolean;

  /* altyapı */
  readonly cache: Cache;
  readonly mailer: Mailer;
  readonly fileStorage: FileStorage;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: LoggerPort;

  /* handler'ların ihtiyaç duyduğu ayarlar */
  readonly publicUrl: string;
  readonly paymentsMode: string;
}
