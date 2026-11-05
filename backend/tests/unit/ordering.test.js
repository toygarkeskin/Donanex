"use strict";

/**
 * Sipariş akışının iş kuralları — veritabanı olmadan, sahte unit of work ile.
 * Burada sınanan şey SQL değil, kuralların kendisidir.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { CommandBus } = require("../../src/application/shared/cqrs/bus");
const ordering = require("../../src/application/ordering");
const { ConflictError, NotFoundError, ValidationError, ForbiddenError } = require("../../src/domain/shared/errors");
const { AccessPolicy } = require("../../src/domain/identity/AccessPolicy");
const { RoleCodes } = require("../../src/domain/identity/Role");
const { createStore, fakeOpaqueTokens, fixedClock, fakeIds, TRACKING_CODE } = require("./fakes");
const { InMemoryCache } = require("../../src/infrastructure/cache/RedisCache");

/** Kimlikler UUID olarak dogrulandigi icin sahte veriler de UUID kullanir. */
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const S1 = "aaaaaaa1-1111-4111-8111-111111111111";
const S2 = "bbbbbbb2-2222-4222-8222-222222222222";
const U1 = "ccccccc1-1111-4111-8111-111111111111";
const U2 = "ddddddd2-2222-4222-8222-222222222222";
const STAFF = "eeeeeee3-3333-4333-8333-333333333333";

const {
  AddToCartCommand,
  UpdateCartItemCommand,
  PlaceOrderCommand,
  ProcessPaymentCommand,
  CancelOrderCommand,
  UpdatePackageStatusCommand,
  ExpireUnpaidOrdersCommand
} = ordering;

const product = (overrides) => ({
  id: P1,
  name: "Ürün A",
  priceCents: 10000,
  stock: 5,
  status: "active",
  imageUrl: "/images/a.png",
  storeId: S1,
  storeName: "Mağaza A",
  storeStatus: "active",
  ...overrides
});

const checkout = {
  contact: { email: "ali@example.com", fullName: "Ali Veli", phone: "0555 000 00 00" },
  shippingAddress: { fullName: "Ali Veli", city: "İstanbul", district: "Kadıköy", line: "Adres 1" }
};

function setup(seed) {
  const store = createStore({
    products: [product({}), product({ id: P2, priceCents: 2500, storeId: S2, storeName: "Mağaza B" })],
    ...seed
  });

  const services = {
    unitOfWork: store.unitOfWork,
    opaqueTokens: fakeOpaqueTokens,
    clock: fixedClock(),
    ids: fakeIds,
    paymentsMode: "simulated",
    // Stok degisince katalog onbellegi temizlenir; testte sayaci tutmak yeter.
    cache: new InMemoryCache()
  };

  const bus = new CommandBus();
  for (const [Message, Handler] of ordering.commandHandlers) bus.register(Message, new Handler(services));

  const stock = (id) => store.state.products.find((p) => p.id === id).stock;
  return { store, bus, stock, services };
}

/** Mağazada tam yetkili bir bağlam. */
const storeContext = (storeId) => ({
  actorId: STAFF,
  policy: new AccessPolicy([
    {
      roleCode: RoleCodes.STORE_OWNER,
      storeId,
      permissions: ["order:read", "order:fulfil", "order:refund"]
    }
  ])
});

/* ------------------------------------------------------------- sepet */

test("Misafir sepete ekleyebilir; sepet sunucuda açılır", async () => {
  const { bus, store } = setup();
  const result = await bus.execute(new AddToCartCommand({ productId: P1, quantity: 2 }));

  assert.equal(result.isGuestCart, true);
  assert.ok(result.cartId);
  assert.equal(store.state.cartItems.length, 1);
  assert.equal(store.state.cartItems[0].quantity, 2);
});

test("Sepete stoktan fazlası eklenemez", async () => {
  const { bus } = setup();
  await assert.rejects(bus.execute(new AddToCartCommand({ productId: P1, quantity: 9 })), ConflictError);
});

test("Satışta olmayan ürün sepete eklenemez", async () => {
  const { bus } = setup({ products: [product({ status: "draft" })] });
  await assert.rejects(bus.execute(new AddToCartCommand({ productId: P1, quantity: 1 })), NotFoundError);
});

test("Sepette olmayan sepet için adet güncellenemez", async () => {
  const { bus } = setup();
  await assert.rejects(
    bus.execute(new UpdateCartItemCommand({ guestCartId: "yok", productId: P1, quantity: 1 })),
    NotFoundError
  );
});

/* ---------------------------------------------------------- sipariş */

async function placeOrder(bus, { userId = null, lines = [[P1, 2]] } = {}) {
  let cartId = null;
  for (const [productId, quantity] of lines) {
    const result = await bus.execute(new AddToCartCommand({ userId, guestCartId: cartId, productId, quantity }));
    cartId = result.cartId;
  }
  const order = await bus.execute(new PlaceOrderCommand({ userId, guestCartId: cartId, checkout }));
  return { order, cartId };
}

test("Sipariş verilince stok düşer, takip kodu üretilir, sepet kapanır", async () => {
  const { bus, stock, store } = setup();
  const { order, cartId } = await placeOrder(bus);

  assert.equal(order.total.cents, 20000);
  assert.equal(order.trackingCode, TRACKING_CODE);
  assert.equal(order.status, "pending_payment");
  assert.equal(stock(P1), 3);
  assert.equal(store.state.carts.find((cart) => cart.id === cartId).status, "converted");
  assert.equal(store.state.outbox.at(-1).type, "order.placed");
});

test("Çok mağazalı sipariş paketlere bölünür", async () => {
  const { bus } = setup();
  const { order } = await placeOrder(bus, { lines: [[P1, 1], [P2, 2]] });

  assert.equal(order.packages.length, 2);
  assert.equal(order.total.cents, 10000 + 5000);
});

test("Boş sepetten sipariş çıkmaz", async () => {
  const { bus } = setup();
  await assert.rejects(bus.execute(new PlaceOrderCommand({ guestCartId: "yok", checkout })), ValidationError);
});

test("Stok sipariş anında yetmezse hiçbir değişiklik kalıcı olmaz", async () => {
  const { bus, stock, store } = setup();
  const added = await bus.execute(new AddToCartCommand({ productId: P1, quantity: 5 }));

  // Sepete eklendikten sonra stok başka bir satışla tükenmiş olsun.
  store.state.products.find((p) => p.id === P1).stock = 1;

  await assert.rejects(
    bus.execute(new PlaceOrderCommand({ guestCartId: added.cartId, checkout })),
    ConflictError
  );
  assert.equal(stock(P1), 1, "stok değişmemeli");
  assert.equal(store.state.orders.length, 0, "sipariş oluşmamalı");
});

/* ----------------------------------------------------------- ödeme */

test("Ödeme takip kodu olmadan işlenemez", async () => {
  const { bus, stock } = setup();
  const { order } = await placeOrder(bus);

  await assert.rejects(
    bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, outcome: "success" })),
    NotFoundError
  );
  await assert.rejects(
    bus.execute(
      new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: "b".repeat(64), outcome: "success" })
    ),
    NotFoundError
  );
  assert.equal(stock(P1), 3, "başarısız denemeler stoğu etkilemez");
});

test("Başarılı ödeme siparişi onaylar ve ikinci kez işlenemez", async () => {
  const { bus, store } = setup();
  const { order } = await placeOrder(bus);
  const pay = (outcome) =>
    bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome }));

  const result = await pay("success");
  assert.equal(result.status, "paid");
  assert.equal(result.simulated, true);
  assert.equal(store.state.payments.at(-1).status, "succeeded");

  await assert.rejects(pay("success"), ConflictError);
});

test("Başarısız ödeme stoğu iade eder", async () => {
  const { bus, stock } = setup();
  const { order } = await placeOrder(bus);

  const result = await bus.execute(
    new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "failure" })
  );
  assert.equal(result.status, "payment_failed");
  assert.equal(stock(P1), 5, "ayrılan stok geri verilir");
});

test("Geçersiz ödeme sonucu reddedilir", async () => {
  const { bus } = setup();
  const { order } = await placeOrder(bus);
  await assert.rejects(
    bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "belki" })),
    ValidationError
  );
});

test("Ödeme benzetimi kapalıysa uç çalışmaz", async () => {
  const { bus: _bus, services, store } = setup();
  const bus = new CommandBus();
  for (const [Message, Handler] of ordering.commandHandlers) {
    bus.register(Message, new Handler({ ...services, paymentsMode: "live" }));
  }
  const { order } = await placeOrder(bus);
  await assert.rejects(
    bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "success" })),
    ConflictError
  );
  assert.ok(store);
});

/* ----------------------------------------------------------- iptal */

test("Müşteri yalnızca kendi siparişini iptal edebilir", async () => {
  const { bus, stock } = setup();
  const { order } = await placeOrder(bus, { userId: U1 });

  await assert.rejects(
    bus.execute(new CancelOrderCommand({ userId: U2, orderId: order.orderId })),
    NotFoundError,
    "başkasının siparişi 'bulunamadı' döner"
  );
  assert.equal(stock(P1), 3);

  const result = await bus.execute(new CancelOrderCommand({ userId: U1, orderId: order.orderId }));
  assert.equal(result.cancelledPackages, 1);
  assert.equal(stock(P1), 5);
});

test("Stok iptalde yalnızca bir kez iade edilir", async () => {
  const { bus, stock } = setup();
  const { order } = await placeOrder(bus, { userId: U1 });

  await bus.execute(new CancelOrderCommand({ userId: U1, orderId: order.orderId }));
  await assert.rejects(bus.execute(new CancelOrderCommand({ userId: U1, orderId: order.orderId })), ConflictError);
  assert.equal(stock(P1), 5, "stok ikinci kez eklenmez");
});

test("Kargoya verilmiş paket müşteri tarafından iptal edilemez", async () => {
  const { bus, store } = setup();
  const { order } = await placeOrder(bus, { userId: U1 });
  await bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "success" }));

  const pkg = store.state.packages[0];
  const context = storeContext(S1);
  await bus.execute(new UpdatePackageStatusCommand({ storeId: S1, packageId: pkg.id, status: "preparing" }), context);
  await bus.execute(new UpdatePackageStatusCommand({ storeId: S1, packageId: pkg.id, status: "shipped" }), context);

  await assert.rejects(bus.execute(new CancelOrderCommand({ userId: U1, orderId: order.orderId })), ConflictError);
});

/* ------------------------------------------------------- mağaza tarafı */

test("Mağaza yalnızca kendi paketine dokunabilir", async () => {
  const { bus, store } = setup();
  const { order } = await placeOrder(bus, { lines: [[P1, 1], [P2, 1]] });
  await bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "success" }));

  const foreign = store.state.packages.find((pkg) => pkg.storeId === S2);

  // Yetki başka mağaza için verilmiş: handler içindeki denetim durdurur.
  await assert.rejects(
    bus.execute(
      new UpdatePackageStatusCommand({ storeId: S2, packageId: foreign.id, status: "preparing" }),
      storeContext(S1)
    ),
    ForbiddenError
  );
});

test("Ödeme tamamlanmadan paket hazırlanamaz", async () => {
  const { bus, store } = setup();
  await placeOrder(bus);
  const pkg = store.state.packages[0];

  await assert.rejects(
    bus.execute(
      new UpdatePackageStatusCommand({ storeId: S1, packageId: pkg.id, status: "preparing" }),
      storeContext(S1)
    ),
    ConflictError
  );
});

test("Paket durumu basamak atlayamaz, teslimde sipariş tamamlanır", async () => {
  const { bus, store } = setup();
  const { order } = await placeOrder(bus);
  await bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "success" }));

  const pkg = store.state.packages[0];
  const context = storeContext(S1);
  const move = (status) =>
    bus.execute(new UpdatePackageStatusCommand({ storeId: S1, packageId: pkg.id, status }), context);

  await assert.rejects(move("delivered"), ConflictError);
  await move("preparing");
  await move("shipped");
  await move("delivered");

  assert.equal(store.state.orders[0].status, "completed", "tüm paketler teslim olunca sipariş tamamlanır");
});

test("İade edilen paketin stoğu geri döner", async () => {
  const { bus, store, stock } = setup();
  const { order } = await placeOrder(bus);
  await bus.execute(new ProcessPaymentCommand({ orderId: order.orderId, trackingCode: TRACKING_CODE, outcome: "success" }));

  const pkg = store.state.packages[0];
  const context = storeContext(S1);
  for (const status of ["preparing", "shipped", "delivered", "refunded"]) {
    await bus.execute(new UpdatePackageStatusCommand({ storeId: S1, packageId: pkg.id, status }), context);
  }
  assert.equal(stock(P1), 5);
});

/* ------------------------------------------------- süresi dolan sipariş */

test("Ödenmeyen sipariş süresi dolunca iptal edilir ve stok iade edilir", async () => {
  const { bus, store, stock } = setup();
  const { order } = await placeOrder(bus);

  // Siparişi iki saat geriye al.
  const saved = store.state.orders.find((item) => item.id === order.orderId);
  saved.placedAt = new Date(Date.parse("2026-01-15T08:00:00.000Z"));

  const result = await bus.execute(new ExpireUnpaidOrdersCommand({ olderThanMinutes: 60 }));
  assert.equal(result.expired, 1);
  assert.equal(stock(P1), 5);
  assert.equal(store.state.orders[0].status, "cancelled");
});

test("Süresi dolmamış sipariş iptal edilmez", async () => {
  const { bus, store } = setup();
  await placeOrder(bus);
  const result = await bus.execute(new ExpireUnpaidOrdersCommand({ olderThanMinutes: 60 }));
  assert.equal(result.expired, 0);
  assert.equal(store.state.orders[0].status, "pending_payment");
});
