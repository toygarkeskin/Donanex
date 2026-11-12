"use strict";

import { defineContext } from "../shared/registry";

import * as OpenTicket from "./commands/OpenTicket";
import * as ReplyToTicket from "./commands/ReplyToTicket";
import * as AddTicketAttachment from "./commands/AddTicketAttachment";
import * as ListTickets from "./queries/ListTickets";
import * as GetTicket from "./queries/GetTicket";
import * as GetTicketAttachment from "./queries/GetTicketAttachment";

export = defineContext({
  name: "support",
  commands: {
    OpenTicket,
    ReplyToTicket,
    AddTicketAttachment,
  },
  queries: {
    ListTickets,
    GetTicket,
    GetTicketAttachment,
  }
});
