"use strict";

import { defineContext } from "../shared/registry";

export = defineContext({
  name: "ordering",
  commands: {
    AddToCart: require("./commands/AddToCart"),
    UpdateCartItem: require("./commands/UpdateCartItem"),
    RemoveFromCart: require("./commands/RemoveFromCart"),
    ClearCart: require("./commands/ClearCart"),
    PlaceOrder: require("./commands/PlaceOrder"),
    ProcessPayment: require("./commands/ProcessPayment"),
    CancelOrder: require("./commands/CancelOrder"),
    UpdatePackageStatus: require("./commands/UpdatePackageStatus"),
    UpdatePackageShipping: require("./commands/UpdatePackageShipping"),
    ExpireUnpaidOrders: require("./commands/ExpireUnpaidOrders")
  },
  queries: {
    GetCart: require("./queries/GetCart"),
    ListMyOrders: require("./queries/ListMyOrders"),
    GetMyOrder: require("./queries/GetMyOrder"),
    TrackOrder: require("./queries/TrackOrder"),
    ListStoreOrders: require("./queries/ListStoreOrders"),
    GetStoreOrder: require("./queries/GetStoreOrder"),
    ListAdminOrders: require("./queries/ListAdminOrders"),
    GetAdminOrder: require("./queries/GetAdminOrder")
  }
});
