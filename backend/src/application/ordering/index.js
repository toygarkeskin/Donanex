"use strict";

const { PlaceOrderCommand } = require("./commands/PlaceOrder/PlaceOrderCommand");
const { PlaceOrderHandler } = require("./commands/PlaceOrder/PlaceOrderHandler");
const { RecordTestPaymentCommand } = require("./commands/RecordTestPayment/RecordTestPaymentCommand");
const { RecordTestPaymentHandler } = require("./commands/RecordTestPayment/RecordTestPaymentHandler");
const { ChangeOrderStatusCommand } = require("./commands/ChangeOrderStatus/ChangeOrderStatusCommand");
const { ChangeOrderStatusHandler } = require("./commands/ChangeOrderStatus/ChangeOrderStatusHandler");
const { UpdateOrderShippingCommand } = require("./commands/UpdateOrderShipping/UpdateOrderShippingCommand");
const { UpdateOrderShippingHandler } = require("./commands/UpdateOrderShipping/UpdateOrderShippingHandler");
const { CancelCustomerOrderCommand } = require("./commands/CancelCustomerOrder/CancelCustomerOrderCommand");
const { CancelCustomerOrderHandler } = require("./commands/CancelCustomerOrder/CancelCustomerOrderHandler");
const { ExpireUnpaidOrdersCommand } = require("./commands/ExpireUnpaidOrders/ExpireUnpaidOrdersCommand");
const { ExpireUnpaidOrdersHandler } = require("./commands/ExpireUnpaidOrders/ExpireUnpaidOrdersHandler");
const { GetOrderPaymentSummaryQuery } = require("./queries/GetOrderPaymentSummary/GetOrderPaymentSummaryQuery");
const { GetOrderPaymentSummaryHandler } = require("./queries/GetOrderPaymentSummary/GetOrderPaymentSummaryHandler");
const { TrackOrderQuery } = require("./queries/TrackOrder/TrackOrderQuery");
const { TrackOrderHandler } = require("./queries/TrackOrder/TrackOrderHandler");
const { ListCustomerOrdersQuery } = require("./queries/ListCustomerOrders/ListCustomerOrdersQuery");
const { ListCustomerOrdersHandler } = require("./queries/ListCustomerOrders/ListCustomerOrdersHandler");
const { ListAdminOrdersQuery } = require("./queries/ListAdminOrders/ListAdminOrdersQuery");
const { ListAdminOrdersHandler } = require("./queries/ListAdminOrders/ListAdminOrdersHandler");
const { GetAdminStatsQuery } = require("./queries/GetAdminStats/GetAdminStatsQuery");
const { GetAdminStatsHandler } = require("./queries/GetAdminStats/GetAdminStatsHandler");

module.exports = {
  PlaceOrderCommand,
  RecordTestPaymentCommand,
  ChangeOrderStatusCommand,
  UpdateOrderShippingCommand,
  CancelCustomerOrderCommand,
  ExpireUnpaidOrdersCommand,
  GetOrderPaymentSummaryQuery,
  TrackOrderQuery,
  ListCustomerOrdersQuery,
  ListAdminOrdersQuery,
  GetAdminStatsQuery,
  commandHandlers: [
    [PlaceOrderCommand, PlaceOrderHandler],
    [RecordTestPaymentCommand, RecordTestPaymentHandler],
    [ChangeOrderStatusCommand, ChangeOrderStatusHandler],
    [UpdateOrderShippingCommand, UpdateOrderShippingHandler],
    [CancelCustomerOrderCommand, CancelCustomerOrderHandler],
    [ExpireUnpaidOrdersCommand, ExpireUnpaidOrdersHandler]
  ],
  queryHandlers: [
    [GetOrderPaymentSummaryQuery, GetOrderPaymentSummaryHandler],
    [TrackOrderQuery, TrackOrderHandler],
    [ListCustomerOrdersQuery, ListCustomerOrdersHandler],
    [ListAdminOrdersQuery, ListAdminOrdersHandler],
    [GetAdminStatsQuery, GetAdminStatsHandler]
  ]
};
