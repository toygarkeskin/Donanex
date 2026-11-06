"use strict";

/**
 * Port arayüzleri — application katmanının dış dünyadan beklediği şekiller.
 *
 * ports.ts ÇALIŞMA ZAMANINDA doğrular (metot var mı), bu dosya DERLEMEDE
 * doğrular (doğru adla ve doğru argümanlarla mı çağrılıyor). İkisi birlikte
 * çalışır.
 *
 * İmzalar infrastructure'daki gerçek repository'lerden birebir çıkarıldı.
 *
 * Satır şekilleri hakkında dürüst not: repository'ler veritabanı satırı
 * döndürür. Bu adımda metot adları ve ARGÜMANLAR tam tiplidir; dönen satırın
 * içeriği "Row" ile geçilmiştir ve infrastructure TypeScript'e taşındığında
 * somut tiplerle daraltılacaktır.
 */

import type { AccessPolicy } from "../../domain/identity/AccessPolicy";
import type { DomainEventShape } from "../../domain/shared/DomainEvent";

/** Veritabanı satırı. İnfrastructure göçünde somut tiplerle değişecek. */
export type Row = Record<string, any>;

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
  updatePasswordHash(id: string, passwordHash: string): Promise<Row | null>;
  changePassword(id: string, passwordHash: string): Promise<Row | null>;
  updateProfile(id: string, input: { fullName: string; phone: string | null }): Promise<Row | null>;
  markEmailVerified(id: string): Promise<Row | null>;
  setStatus(id: string, status: string): Promise<Row | null>;
  touchLastLogin(id: string): Promise<unknown>;
  addAddress(userId: string, address: Row): Promise<Row>;
  updateAddress(userId: string, addressId: string, address: Row): Promise<Row | null>;
  removeAddress(userId: string, addressId: string): Promise<boolean>;
}

export interface RoleRepository {
  findByCode(code: string): Promise<Row | null>;
  assign(input: { userId: string; roleCode: string; storeId?: string | null }): Promise<Row>;
  revoke(input: { userId: string; roleCode: string; storeId?: string | null }): Promise<boolean>;
  listForUser(userId: string): Promise<Row[]>;
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
  findActiveById(id: string, now: Date): Promise<Row | null>;
  revoke(id: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<number>;
  purgeExpired(): Promise<number>;
}

export interface OAuthRepository {
  findClient(clientId: string): Promise<Row | null>;
  saveAuthorizationCode(code: Row): Promise<Row>;
  /** Kodu TÜKETİR: tek kullanımlıktır ve doğrulamadan ÖNCE yakılır. */
  consumeAuthorizationCode(codeHash: string, now: Date): Promise<Row | null>;
  saveRefreshToken(token: Row): Promise<Row>;
  findRefreshTokenByHash(tokenHash: string): Promise<Row | null>;
  markRefreshTokenUsed(id: string, now: Date): Promise<Row | null>;
  /** Çalınan jeton tespitinde tüm aileyi iptal eder. */
  revokeRefreshTokenFamily(familyId: string): Promise<number>;
  revokeRefreshTokensForUser(userId: string): Promise<number>;
  revokeRefreshTokensForSession(sessionId: string): Promise<number>;
  upsertClient(client: Row): Promise<Row>;
  purgeExpired(): Promise<number>;
}

export interface VerificationTokenRepository {
  replace(input: { purpose: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<Row>;
  consume(purpose: string, tokenHash: string, now: Date): Promise<Row | null>;
  purgeExpired(): Promise<number>;
}

export interface StoreRepository {
  create(store: Row): Promise<Row>;
  findById(id: string): Promise<Row | null>;
  exists(id: string): Promise<boolean>;
  slugExists(slug: string): Promise<boolean>;
  hasPendingApplication(userId: string): Promise<boolean>;
  update(id: string, data: Row): Promise<Row | null>;
  setStatus(id: string, status: string): Promise<Row | null>;
  /** Demo tohumlaması doğrudan sorgu çalıştırmak için kullanır. */
  readonly db?: { query(text: string, params?: readonly unknown[]): Promise<{ rows: Row[] }> };
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
  /** SELECT … FOR UPDATE: eş zamanlı siparişlerde fazla satışı engeller. */
  lockForOrder(productIds: readonly string[]): Promise<Row[]>;
  decreaseStock(productId: string, quantity: number): Promise<Row | null>;
  increaseStock(productId: string, quantity: number): Promise<Row | null>;
}

export interface CategoryRepository {
  create(input: { id: string; name: string; slug: string; parentId: string | null }): Promise<Row | null>;
  findBySlug(slug: string): Promise<Row | null>;
}

export interface CartRepository {
  findById(id: string): Promise<Row | null>;
  findByUser(userId: string): Promise<Row | null>;
  findOrCreateForUser(userId: string): Promise<Row>;
  createGuestCart(): Promise<Row>;
  listLines(cartId: string): Promise<Row[]>;
  setLine(cartId: string, productId: string, quantity: number): Promise<Row | null>;
  removeLine(cartId: string, productId: string): Promise<boolean>;
  replaceLines(cartId: string, lines: readonly Row[]): Promise<unknown>;
  remove(cartId: string): Promise<boolean>;
  markConverted(cartId: string, orderId: string): Promise<boolean>;
  touch(cartId: string): Promise<unknown>;
  purgeAbandonedGuestCarts(before: Date): Promise<number>;
}

export interface OrderRepository {
  nextOrderNumber(): Promise<string>;
  create(order: Row): Promise<Row>;
  findById(id: string): Promise<Row | null>;
  lockForUser(orderId: string, userId: string | null): Promise<Row | null>;
  lockForPayment(input: { orderId: string; userId?: string | null; trackingCodeHash?: string | null }): Promise<Row | null>;
  lockUnpaidOlderThan(cutoff: Date, limit: number): Promise<Row[]>;
  listPackages(orderId: string): Promise<Row[]>;
  listPackageStatuses(orderId: string): Promise<string[]>;
  listPackageItems(packageId: string): Promise<Row[]>;
  lockPackageForStore(packageId: string, storeId: string): Promise<Row | null>;
  setStatus(orderId: string, status: string): Promise<Row | null>;
  setPackageStatus(packageId: string, status: string): Promise<Row | null>;
  /** Stoğun yalnızca BİR KEZ iade edilmesini sağlar. */
  markPackageStockReleased(packageId: string): Promise<boolean>;
  setPackageShipping(packageId: string, storeId: string, shipping: Row): Promise<Row | null>;
  recordPayment(payment: Row): Promise<Row>;
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
  }): Promise<Row>;
  setTicketStatus(ticketId: string, status: string): Promise<Row | null>;
}

export interface OutboxRepository {
  /** Olay, onu doğuran veriyle AYNI transaction'da yazılır. */
  add(event: DomainEventShape): Promise<Row>;
  claimPending(limit: number): Promise<Row[]>;
  markPublished(ids: readonly string[]): Promise<unknown>;
  markFailed(id: string, error: string): Promise<unknown>;
}

export interface AuditRepository {
  record(input: {
    actorId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Row;
    context?: Row;
  }): Promise<Row | null>;
}

/** Tek transaction içinde verilen repository seti. */
export interface Repositories {
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
  listProducts(filters: Row): Promise<Row>;
  getProductBySlug(storeSlug: string, productSlug: string): Promise<Row | null>;
  listCategories(): Promise<Row[]>;
  listStoreProducts(storeId: string, filters: Row): Promise<Row>;
  getProductForStore(storeId: string, productId: string): Promise<Row | null>;
}

export interface StoreReadModel {
  getBySlug(slug: string): Promise<Row | null>;
  listPublic(filters: Row): Promise<Row>;
  listForAdmin(filters: Row): Promise<Row>;
  getForMember(storeId: string): Promise<Row | null>;
  listMembers(storeId: string): Promise<Row[]>;
  listForMember(userId: string): Promise<Row[]>;
}

export interface CartReadModel {
  getLines(cartId: string): Promise<Row[]>;
  findCartId(input: Row): Promise<string | null>;
}

export interface OrderReadModel {
  listForUser(userId: string, filters: Row): Promise<Row>;
  getForUser(orderId: string, userId: string): Promise<Row | null>;
  getByTrackingCode(orderNumber: string, trackingCodeHash: string): Promise<Row | null>;
  listForStore(storeId: string, filters: Row): Promise<Row>;
  getForStore(storeId: string, packageId: string): Promise<Row | null>;
  listForAdmin(filters: Row): Promise<Row>;
  getForAdmin(orderId: string): Promise<Row | null>;
}

export interface UserReadModel {
  getProfile(userId: string): Promise<Row | null>;
  listForAdmin(filters: Row): Promise<Row>;
  getAccessPolicy(userId: string): Promise<AccessPolicy>;
  getSessionVersion(userId: string): Promise<number | null>;
  listAddresses(userId: string): Promise<Row[]>;
}

export interface SupportReadModel {
  listForUser(userId: string, filters: Row): Promise<Row>;
  listForStore(storeId: string, filters: Row): Promise<Row>;
  listForAdmin(filters: Row): Promise<Row>;
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

export interface TokenIssuer {
  issueAccessToken(input: Row): Row;
  issueIdToken(input: Row): Row;
  verifyAccessToken(token: string): Row;
  jwks(): Row;
}

export interface OpaqueTokens {
  generate(): string;
  hash(value: string): string;
  isWellFormed(value: unknown): boolean;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
  /** Kullanıcı yokken de aynı süreyi harcar: zamanlama sızıntısını kapatır. */
  verifyDummy(): Promise<unknown>;
  needsRehash(stored: string): boolean;
}

export interface Pkce {
  verify(challenge: string, verifier: unknown, method: string): boolean;
}

export interface Cache {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  deleteByPrefix(prefix: string): Promise<unknown>;
}

export interface Mailer {
  send(message: Row): Promise<unknown>;
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
