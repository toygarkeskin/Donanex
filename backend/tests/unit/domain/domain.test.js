"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { Order } = require("../../../src/domain/ordering/Order");
const { OrderStatus, assertTransition, nextStatuses } = require("../../../src/domain/ordering/OrderStatus");
const { createShipping } = require("../../../src/domain/ordering/Shipping");
const { Product } = require("../../../src/domain/catalog/Product");
const { validateRegistration, assertNewPassword } = require("../../../src/domain/customers/Customer");
const { createSupportRequest } = require("../../../src/domain/support/SupportRequest");
const { isId } = require("../../../src/domain/shared/guards");
const { toCents } = require("../../../src/domain/shared/money");
const { ValidationError, ConflictError } = require("../../../src/domain/shared/errors");

const products = [
  { id: 1, name: "Laptop", price: "67000.00", stock: 2 },
  { id: 2, name: "Mouse", price: "19.99", stock: 5 }
];
const line = (productId, quantity) => ({ productId, quantity });
const checkout = (items) => ({
  fullName: "Ali Veli",
  email: "ALI@example.com",
  phone: "0555 000 00 00",
  address: "İstanbul",
  items
});

test("Order.place toplamı sunucuda kuruş hassasiyetiyle hesaplar", () => {
  const order = Order.place({ recipient: {}, items: [line(2, 3), line(1, 1)], products });
  assert.equal(order.total, "67059.97");
  assert.deepEqual(
    order.lines.map((l) => [l.productName, l.quantity, l.unitPrice]),
    [["Mouse", 3, "19.99"], ["Laptop", 1, "67000.00"]]
  );
  assert.equal(order.status, OrderStatus.AWAITING_PAYMENT);
});

test("Order.place stok yetmezse ConflictError fırlatır", () => {
  assert.throws(
    () => Order.place({ recipient: {}, items: [line(1, 3)], products }),
    (e) => e instanceof ConflictError && /Mevcut stok: 2/.test(e.message)
  );
});

test("Order.place satışta olmayan ürünü reddeder", () => {
  assert.throws(() => Order.place({ recipient: {}, items: [line(99, 1)], products }), ValidationError);
});

test("validateCheckout aynı ürünü birleştirir, e-postayı küçültür", () => {
  const { items, recipient } = Order.validateCheckout(checkout([line(1, 1), line(1, 2), line(2, 1)]));
  assert.deepEqual(items, [line(1, 3), line(2, 1)]);
  assert.equal(recipient.email, "ali@example.com");
});

test("validateCheckout kötü girdileri reddeder", () => {
  for (const items of [[], [line(1, 0)], [line(1, -1)], [line(1, 1.5)], [line(1, 100)], [line("x", 1)], [{ name: "Mouse" }], "x"]) {
    assert.throws(() => Order.validateCheckout(checkout(items)), ValidationError);
  }
  assert.throws(() => Order.validateCheckout({ ...checkout([line(1, 1)]), email: "x" }), ValidationError);
  assert.throws(() => Order.validateCheckout({ ...checkout([line(1, 1)]), phone: "<script>" }), ValidationError);
  assert.throws(() => Order.validateCheckout(null), ValidationError);
});

test("Sipariş yaşam döngüsü geçersiz geçişi engeller", () => {
  assert.doesNotThrow(() => assertTransition(OrderStatus.TEST_SUCCEEDED, OrderStatus.PREPARING));
  assert.throws(() => assertTransition(OrderStatus.DELIVERED, OrderStatus.AWAITING_PAYMENT), ConflictError);
  assert.throws(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PREPARING), ConflictError);
  assert.deepEqual(nextStatuses(OrderStatus.COMPLETED), []);
});

test("Product.create alanları doğrular ve kırpar", () => {
  const base = { description: "d", image: "/assets/i.png", category: "K" };
  const p = Product.create({ ...base, name: " Klavye ", price: "10.5", stock: "3" });
  assert.equal(p.name, "Klavye");
  assert.equal(p.price, "10.50");
  assert.equal(p.stock, 3);
  assert.throws(() => Product.create({ name: "x" }), ValidationError);
  assert.throws(() => Product.create({ ...base, name: "x", price: -1, stock: 1 }), ValidationError);
  assert.throws(() => Product.create({ ...base, name: "x", price: null, stock: 1 }), ValidationError);
  assert.throws(() => Product.create({ ...base, name: "x", price: 1, stock: null }), ValidationError);
});

test("Product görseli yalnızca yerel varlık veya https olabilir", () => {
  const base = { name: "x", description: "d", category: "K", price: 1, stock: 1 };
  for (const image of ["javascript:alert(1)", "http://evil.test/a.png", "data:text/html,x", "/assets/../../etc/passwd", "x\" onerror=\"alert(1)"]) {
    assert.throws(() => Product.create({ ...base, image }), ValidationError, image);
  }
  assert.equal(Product.create({ ...base, image: "https://cdn.example.com/a.png" }).image, "https://cdn.example.com/a.png");
});

test("Product.fromImportRow eksik alanlara varsayılan verir", () => {
  const p = Product.fromImportRow({ name: "SSD", price: 1200 }, 2);
  assert.equal(p.category, "Genel");
  assert.equal(p.description, "SSD");
  assert.equal(p.stock, 0);
  assert.throws(() => Product.fromImportRow({ name: "", price: 1 }, 7), /7\. satır/);
});

test("createShipping yalnızca http/https bağlantı kabul eder", () => {
  assert.equal(createShipping({ tracking_url: "https://kargo.example/1" }).trackingUrl, "https://kargo.example/1");
  assert.equal(createShipping({}).company, null);
  assert.throws(() => createShipping({ tracking_url: "javascript:alert(1)" }), ValidationError);
});

test("validateRegistration e-postayı küçültür, zayıf parolayı reddeder", () => {
  assert.equal(validateRegistration({ name: "Ali", email: " ALI@X.COM ", password: "abc12345" }).email, "ali@x.com");
  assert.throws(() => assertNewPassword("kisa1"), ValidationError);
  assert.throws(() => assertNewPassword("12345678"), /harf/);
  assert.throws(() => assertNewPassword("sadeceharf"), /rakam/);
});

test("createSupportRequest e-posta biçimini ve nesne girdiyi denetler", () => {
  assert.throws(() => createSupportRequest({ fullName: "A", email: "yok", message: "m" }), ValidationError);
  assert.throws(() => createSupportRequest({ fullName: {}, email: "a@b.co", message: "m" }), ValidationError);
  assert.equal(createSupportRequest({ fullName: "A", email: "a@b.co", message: "m" }).phone, "");
});

test("Kimlik ve para sınırları taşmaya izin vermez", () => {
  assert.equal(isId("2147483647"), true);
  assert.equal(isId("2147483648"), false);
  assert.equal(isId("1 OR 1=1"), false);
  assert.equal(isId(0), false);
  assert.equal(toCents(null), null);
  assert.equal(toCents(""), null);
  assert.equal(toCents("1e20"), null);
  assert.equal(toCents(true), null);
  assert.equal(toCents("19.99"), 1999);
});
