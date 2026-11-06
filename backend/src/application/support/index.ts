"use strict";

import { defineContext } from "../shared/registry";

import * as OpenTicket from "./commands/OpenTicket";
import * as ReplyToTicket from "./commands/ReplyToTicket";
import * as ListTickets from "./queries/ListTickets";
import * as GetTicket from "./queries/GetTicket";

export = defineContext({
  name: "support",
  commands: {
    OpenTicket,
    ReplyToTicket,
  },
  queries: {
    ListTickets,
    GetTicket,
  }
});
