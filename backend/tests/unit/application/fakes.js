"use strict";

/**
 * Bellek içi sahte Unit of Work: handler'ları veritabanı olmadan test etmeye yarar.
 * Gerçek transaction gibi davranır: callback hata fırlatırsa değişiklikler geri alınır.
 */
function createInMemoryStore({ products = [] } = {}) {
  let state = { products: products.map((p) => ({ ...p })), orders: [], items: [] };
  let nextOrderId = 100;

  const repos = (s) => ({
    products: {
      lockActiveByIds: async (ids) => s.products.filter((p) => ids.includes(p.id) && p.active !== false),
      decreaseStock: async (id, q) => {
        s.products.find((p) => p.id === id).stock -= q;
      },
      increaseStock: async (id, q) => {
        s.products.find((p) => p.id === id).stock += q;
      }
    },
    orders: {
      add: async (order, hash) => {
        const id = nextOrderId++;
        s.orders.push({ id, status: order.status, total: order.total, stockRestored: false, hash, customerId: order.customerId });
        order.lines.forEach((l) => s.items.push({ orderId: id, productId: l.productId, quantity: l.quantity }));
        return { id, total: order.total, status: order.status };
      },
      lockById: async (id) => {
        const o = s.orders.find((x) => x.id === id);
        return o ? { ...o } : null;
      },
      lockByIdAndTrackingHash: async (id, hash) => {
        const o = s.orders.find((x) => x.id === id && x.hash === hash);
        return o ? { ...o } : null;
      },
      findLines: async (id) => s.items.filter((i) => i.orderId === id),
      setStatus: async (id, status) => {
        const o = s.orders.find((x) => x.id === id);
        o.status = status;
        return { id, status, total: o.total };
      },
      markStockRestored: async (id) => {
        s.orders.find((x) => x.id === id).stockRestored = true;
      }
    }
  });

  return {
    get state() {
      return state;
    },
    unitOfWork: {
      async run(work) {
        const draft = structuredClone(state);
        const result = await work(repos(draft));
        state = draft; // commit
        return result;
      }
    }
  };
}

const CODE = "a".repeat(48);
const fakeOpaqueTokens = {
  generate: () => CODE,
  hash: (c) => `hash:${c}`,
  isWellFormed: (c) => typeof c === "string" && c.length === 48
};

module.exports = { createInMemoryStore, fakeOpaqueTokens, CODE };
