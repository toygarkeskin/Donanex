"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { CommandBus, QueryBus } = require("../../../src/application/shared/cqrs/bus");
const ordering = require("../../../src/application/ordering");
const { ListStoreProductsQuery } = require("../../../src/application/catalog");
const { ConflictError, NotFoundError } = require("../../../src/domain/shared/errors");
const { createInMemoryStore, fakeOpaqueTokens, CODE } = require("./fakes");

const {
  PlaceOrderCommand,
  RecordTestPaymentCommand,
  ChangeOrderStatusCommand,
  CancelCustomerOrderCommand
} = ordering;

const checkout = (items) => ({
  fullName: "Test Kişi",
  email: "test@example.com",
  phone: "05550000000",
  address: "İstanbul",
  items: items.map(([productId, quantity]) => ({ productId, quantity }))
});

function setup() {
  const store = createInMemoryStore({
    products: [
      { id: 1, name: "Laptop", price: "100.00", stock: 3 },
      { id: 2, name: "Mouse", price: "10.00", stock: 1 },
      { id: 3, name: "Eski", price: "5.00", stock: 9, active: false }
    ]
  });
  const deps = { unitOfWork: store.unitOfWork, opaqueTokens: fakeOpaqueTokens };
  const bus = new CommandBus();
  for (const [Command, Handler] of ordering.commandHandlers) bus.register(Command, new Handler(deps));
  const stock = (id) => store.state.products.find((p) => p.id === id).stock;
  return { store, bus, stock };
}

test("Sipariş verilince stok düşer ve takip kodu döner", async () => {
  const { bus, stock } = setup();
  const result = await bus.execute(new PlaceOrderCommand(checkout([[1, 2], [2, 1]])));
  assert.equal(result.total, "210.00");
  assert.equal(result.trackingCode.length, 48);
  assert.equal(stock(1), 1);
  assert.equal(stock(2), 0);
});

test("Stok yetmezse hiçbir değişiklik kalıcı olmaz", async () => {
  const { bus, stock, store } = setup();
  await assert.rejects(bus.execute(new PlaceOrderCommand(checkout([[2, 2]]))), ConflictError);
  assert.equal(stock(2), 1);
  assert.equal(store.state.orders.length, 0);
});

test("Satıştan kaldırılmış ürün sipariş edilemez", async () => {
  const { bus } = setup();
  await assert.rejects(bus.execute(new PlaceOrderCommand(checkout([[3, 1]]))), /satışta olmayan/);
});

test("Test ödemesi takip kodu olmadan yapılamaz", async () => {
  const { bus, stock, store } = setup();
  const { orderId } = await bus.execute(new PlaceOrderCommand(checkout([[1, 1]])));

  await assert.rejects(bus.execute(new RecordTestPaymentCommand(orderId, undefined, false)), NotFoundError);
  await assert.rejects(bus.execute(new RecordTestPaymentCommand(orderId, "b".repeat(48), false)), NotFoundError);

  assert.equal(store.state.orders[0].status, "Ödeme bekleniyor");
  assert.equal(stock(1), 2);
});

test("Başarısız test ödemesi stoğu iade eder ve tekrarlanamaz", async () => {
  const { bus, stock } = setup();
  const { orderId } = await bus.execute(new PlaceOrderCommand(checkout([[1, 2]])));
  assert.equal(stock(1), 1);

  const order = await bus.execute(new RecordTestPaymentCommand(String(orderId), CODE, false));
  assert.equal(order.status, "Test başarısız");
  assert.equal(stock(1), 3);

  await assert.rejects(bus.execute(new RecordTestPaymentCommand(String(orderId), CODE, true)), ConflictError);
});

test("İptal stoğu bir kez iade eder ve sipariş yeniden aktif edilemez", async () => {
  const { bus, stock } = setup();
  const { orderId } = await bus.execute(new PlaceOrderCommand(checkout([[1, 1]])));
  await bus.execute(new ChangeOrderStatusCommand(String(orderId), "İptal edildi"));
  await bus.execute(new ChangeOrderStatusCommand(String(orderId), "İptal edildi"));
  assert.equal(stock(1), 3, "stok yalnızca bir kez iade edilmeli");

  await assert.rejects(bus.execute(new ChangeOrderStatusCommand(String(orderId), "Hazırlanıyor")), ConflictError);
});

test("Müşteri yalnızca kendi siparişini iptal edebilir", async () => {
  const { bus, stock } = setup();
  const { orderId } = await bus.execute(new PlaceOrderCommand(checkout([[1, 1]]), "7"));

  await assert.rejects(bus.execute(new CancelCustomerOrderCommand("8", String(orderId))), NotFoundError);
  assert.equal(stock(1), 2);

  await bus.execute(new CancelCustomerOrderCommand("7", String(orderId)));
  assert.equal(stock(1), 3);
});

test("Kargoya verilmiş sipariş müşteri tarafından iptal edilemez", async () => {
  const { bus } = setup();
  const { orderId } = await bus.execute(new PlaceOrderCommand(checkout([[1, 1]]), "7"));
  await bus.execute(new ChangeOrderStatusCommand(String(orderId), "Hazırlanıyor"));
  await bus.execute(new ChangeOrderStatusCommand(String(orderId), "Kargoya verildi"));
  await assert.rejects(bus.execute(new CancelCustomerOrderCommand("7", String(orderId))), ConflictError);
});

test("Bus: kayıtsız mesaj ve yanlış veri yolu hata verir", async () => {
  const { bus } = setup();
  await assert.rejects(bus.execute(new ListStoreProductsQuery()), /handler/);
  await assert.rejects(new QueryBus().ask(new PlaceOrderCommand({})), /handler/);
  assert.throws(() => bus.register(PlaceOrderCommand, { handle() {} }), /zaten/);
});
