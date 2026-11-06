"use strict";

import { defineContext } from "../shared/registry";

import * as ApplyForStore from "./commands/ApplyForStore";
import * as SetStoreStatus from "./commands/SetStoreStatus";
import * as UpdateStore from "./commands/UpdateStore";
import * as ManageStoreMember from "./commands/ManageStoreMember";
import * as GetStore from "./queries/GetStore";
import * as ListStores from "./queries/ListStores";
import * as ListStoresForAdmin from "./queries/ListStoresForAdmin";
import * as GetStoreForMember from "./queries/GetStoreForMember";
import * as ListStoreMembers from "./queries/ListStoreMembers";

export = defineContext({
  name: "stores",
  commands: {
    ApplyForStore,
    SetStoreStatus,
    UpdateStore,
    ManageStoreMember,
  },
  queries: {
    GetStore,
    ListStores,
    ListStoresForAdmin,
    GetStoreForMember,
    ListStoreMembers,
  }
});
