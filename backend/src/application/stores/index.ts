"use strict";

import { defineContext } from "../shared/registry";

export = defineContext({
  name: "stores",
  commands: {
    ApplyForStore: require("./commands/ApplyForStore"),
    SetStoreStatus: require("./commands/SetStoreStatus"),
    UpdateStore: require("./commands/UpdateStore"),
    ManageStoreMember: require("./commands/ManageStoreMember")
  },
  queries: {
    GetStore: require("./queries/GetStore"),
    ListStores: require("./queries/ListStores"),
    ListStoresForAdmin: require("./queries/ListStoresForAdmin"),
    GetStoreForMember: require("./queries/GetStoreForMember"),
    ListStoreMembers: require("./queries/ListStoreMembers")
  }
});
