"use strict";

import { defineContext } from "../shared/registry";

export = defineContext({
  name: "support",
  commands: {
    OpenTicket: require("./commands/OpenTicket"),
    ReplyToTicket: require("./commands/ReplyToTicket")
  },
  queries: {
    ListTickets: require("./queries/ListTickets"),
    GetTicket: require("./queries/GetTicket")
  }
});
