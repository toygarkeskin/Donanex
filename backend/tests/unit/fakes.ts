"use strict";

import type { Row } from "../../src/application/shared/contracts";

import crypto from "crypto";

/**
 * Bellek içi sahteler: application katmanını veritabanı, Redis ya da SMTP
 * olmadan test etmeye yarar.
 *
 * Sahte unit of work gerçek bir transaction gibi davranır: callback hata
 * fırlatırsa hiçbir değişiklik kalıcı olmaz. Böylece "hata olunca geri
 * alınıyor mu?" sorusu veritabanı olmadan da sınanabilir.
 */
/**
 * Sahte deponun tuttugu tablolar.
 *
 * Her tablo Row dizisi: sahtenin isi gercek sema degil, kullanim senaryosunun
 * okudugu alanlari tasimak. Tipi burada tek yerde vermek, asagidaki onlarca
 * find/filter geri cagirmasinin ortuk any kalmasini onluyor.
 */
export type FakeState = Record<string, Row[]>;

/**
 * Sahte depoda olmasi gereken satir.
 *
 * Satir yoksa test kurulumu yanlistir. Sessizce undefined uzerinde islem
 * yapmak yerine nedenini soyleyerek dusuyoruz; aksi halde hata, asil
 * nedeninden cok uzakta "undefined okunamiyor" diye ortaya cikar.
 */
export function satir(deger: Row | undefined, ne: string): Row {
  if (!deger) throw new Error(`Sahte depoda ${ne} yok (test kurulumu eksik).`);
  return deger;
}

function createStore(seed: Partial<FakeState> = {}) {
  let state: FakeState = structuredClone({
    products: [],
    stores: [],
    carts: [],
    cartItems: [],
    orders: [],
    packages: [],
    orderItems: [],
    payments: [],
    outbox: [],
    audit: [],
    ...seed
  });

  let sequence = 1000;
  // Kimlikler UUID olarak dogrulandigi icin sahteler de UUID uretir.
  const nextId = () => crypto.randomUUID();

  const repos = (s: FakeState) => ({
    products: {
      findPurchasable: async (id: string) => {
        const product = s.products.find((p) => p.id === id);
        return product && product.status === "active" && product.storeStatus !== "suspended" ? { ...product } : null;
      },
      lockForOrder: async (ids: string[]) => new Map(s.products.filter((p) => ids.includes(p.id)).map((p) => [p.id, { ...p }])),
      decreaseStock: async (id: string, quantity: number) => {
        satir(s.products.find((p) => p.id === id), `urun ${id}`).stock -= quantity;
      },
      increaseStock: async (id: string, quantity: number) => {
        satir(s.products.find((p) => p.id === id), `urun ${id}`).stock += quantity;
      }
    },

    carts: {
      findById: async (id: string) => s.carts.find((c) => c.id === id && c.status === "active") ?? null,
      findByUser: async (userId: string) => s.carts.find((c) => c.userId === userId && c.status === "active") ?? null,
      findOrCreateForUser: async (userId: string) => {
        const existing = s.carts.find((c) => c.userId === userId && c.status === "active");
        if (existing) return existing;
        const cart = { id: nextId(), userId, status: "active" };
        s.carts.push(cart);
        return cart;
      },
      createGuestCart: async () => {
        const cart = { id: nextId(), userId: null, status: "active" };
        s.carts.push(cart);
        return cart;
      },
      listLines: async (cartId: string) =>
        s.cartItems.filter((item) => item.cartId === cartId).map(({ productId, quantity }) => ({ productId, quantity })),
      setLine: async (cartId: string, productId: string, quantity: number) => {
        const line = s.cartItems.find((item) => item.cartId === cartId && item.productId === productId);
        if (line) line.quantity = quantity;
        else s.cartItems.push({ cartId, productId, quantity });
        return { quantity };
      },
      removeLine: async (cartId: string, productId: string) => {
        s.cartItems = s.cartItems.filter((item) => !(item.cartId === cartId && item.productId === productId));
      },
      replaceLines: async (cartId: string, lines: Row[]) => {
        s.cartItems = s.cartItems.filter((item) => item.cartId !== cartId);
        for (const line of lines) s.cartItems.push({ cartId, ...line });
      },
      remove: async (cartId: string) => {
        s.carts = s.carts.filter((cart) => cart.id !== cartId);
        s.cartItems = s.cartItems.filter((item) => item.cartId !== cartId);
      },
      markConverted: async (cartId: string, orderId: string) => {
        const cart = satir(s.carts.find((c) => c.id === cartId), `sepet ${cartId}`);
        cart.status = "converted";
        cart.convertedOrderId = orderId;
      }
    },

    orders: {
      nextOrderNumber: async () => `PZ-TEST-${sequence++}`,
      create: async (order: Row) => {
        const saved = {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalCents: order.total.cents,
          userId: order.userId,
          contactEmail: order.contact.email,
          contactFullName: order.contact.fullName,
          trackingCodeHash: order.trackingCodeHash,
          placedAt: order.placedAt
        };
        s.orders.push(saved);
        for (const pkg of order.packages) {
          const id = nextId();
          s.packages.push({
            id,
            orderId: saved.id,
            storeId: pkg.storeId,
            status: pkg.status,
            subtotalCents: pkg.subtotal.cents,
            stockReleased: false
          });
          for (const item of pkg.items) {
            s.orderItems.push({ packageId: id, productId: item.productId, quantity: item.quantity });
          }
        }
        return saved;
      },
      findById: async (id: string) => s.orders.find((order) => order.id === id) ?? null,
      lockForUser: async (orderId: string, userId: string) =>
        s.orders.find((order) => order.id === orderId && order.userId === userId) ?? null,
      lockForPayment: async ({ orderId, userId, trackingCodeHash }: Row) =>
        s.orders.find(
          (order) =>
            order.id === orderId &&
            ((userId && order.userId === userId) || (trackingCodeHash && order.trackingCodeHash === trackingCodeHash))
        ) ?? null,
      lockUnpaidOlderThan: async (cutoff: Date, limit: number) =>
        s.orders.filter((order) => order.status === "pending_payment" && order.placedAt < cutoff).slice(0, limit),
      listPackages: async (orderId: string) => s.packages.filter((pkg) => pkg.orderId === orderId).map((pkg) => ({ ...pkg })),
      listPackageStatuses: async (orderId: string) =>
        s.packages.filter((pkg) => pkg.orderId === orderId).map((pkg) => pkg.status),
      listPackageItems: async (packageId: string) => s.orderItems.filter((item) => item.packageId === packageId),
      lockPackageForStore: async (packageId: string, storeId: string) =>
        s.packages.find((pkg) => pkg.id === packageId && pkg.storeId === storeId) ?? null,
      setStatus: async (orderId: string, status: string) => {
        const order = satir(s.orders.find((item) => item.id === orderId), `siparis ${orderId}`);
        order.status = status;
        return { id: orderId, status };
      },
      setPackageStatus: async (packageId: string, status: string) => {
        const pkg = satir(s.packages.find((item) => item.id === packageId), `paket ${packageId}`);
        pkg.status = status;
        return { ...pkg };
      },
      markPackageStockReleased: async (packageId: string) => {
        satir(s.packages.find((pkg) => pkg.id === packageId), `paket ${packageId}`).stockReleased = true;
      },
      setPackageShipping: async (packageId: string, storeId: string, shipping: Row) => {
        const pkg = s.packages.find((item) => item.id === packageId && item.storeId === storeId);
        if (!pkg) return null;
        Object.assign(pkg, shipping);
        return { ...pkg };
      },
      recordPayment: async (payment: Row) => {
        s.payments.push(payment);
      }
    },

    outbox: {
      add: async (event: Row) => {
        s.outbox.push(event);
      }
    },
    audit: {
      record: async (entry: Row) => {
        s.audit.push(entry);
      }
    }
  });

  return {
    get state() {
      return state;
    },
    unitOfWork: {
      async run(work: (repos: any) => Promise<any>) {
        // Taslak üzerinde çalışılır; hata olursa taslak atılır (rollback).
        const draft = structuredClone(state);
        const result = await work(repos(draft));
        state = draft;
        return result;
      }
    }
  };
}

const TRACKING_CODE = "a".repeat(64);

const fakeOpaqueTokens = {
  generate: () => TRACKING_CODE,
  hash: (value: Row) => `hash:${value}`,
  isWellFormed: (value: Row) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
};

const fixedClock = (iso = "2026-01-15T10:00:00.000Z") => ({ now: () => new Date(iso) });

let idCounter = 0;
const fakeIds = {
  uuid: () => {
    idCounter++;
    return crypto.randomUUID();
  }
};

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  }
};

export { createStore, fakeOpaqueTokens, fixedClock, fakeIds, silentLogger, TRACKING_CODE };
