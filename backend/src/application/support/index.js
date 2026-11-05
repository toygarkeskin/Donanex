"use strict";

const { defineContext } = require("../shared/registry");

module.exports = defineContext({
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
