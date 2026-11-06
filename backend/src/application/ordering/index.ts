"use strict";

import { defineContext } from "../shared/registry";

import * as AddToCart from "./commands/AddToCart";
import * as UpdateCartItem from "./commands/UpdateCartItem";
import * as RemoveFromCart from "./commands/RemoveFromCart";
import * as ClearCart from "./commands/ClearCart";
import * as PlaceOrder from "./commands/PlaceOrder";
import * as ProcessPayment from "./commands/ProcessPayment";
import * as CancelOrder from "./commands/CancelOrder";
import * as UpdatePackageStatus from "./commands/UpdatePackageStatus";
import * as UpdatePackageShipping from "./commands/UpdatePackageShipping";
import * as ExpireUnpaidOrders from "./commands/ExpireUnpaidOrders";
import * as GetCart from "./queries/GetCart";
import * as ListMyOrders from "./queries/ListMyOrders";
import * as GetMyOrder from "./queries/GetMyOrder";
import * as TrackOrder from "./queries/TrackOrder";
import * as ListStoreOrders from "./queries/ListStoreOrders";
import * as GetStoreOrder from "./queries/GetStoreOrder";
import * as ListAdminOrders from "./queries/ListAdminOrders";
import * as GetAdminOrder from "./queries/GetAdminOrder";

export = defineContext({
  name: "ordering",
  commands: {
    AddToCart,
    UpdateCartItem,
    RemoveFromCart,
    ClearCart,
    PlaceOrder,
    ProcessPayment,
    CancelOrder,
    UpdatePackageStatus,
    UpdatePackageShipping,
    ExpireUnpaidOrders,
  },
  queries: {
    GetCart,
    ListMyOrders,
    GetMyOrder,
    TrackOrder,
    ListStoreOrders,
    GetStoreOrder,
    ListAdminOrders,
    GetAdminOrder,
  }
});
