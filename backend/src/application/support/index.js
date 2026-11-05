"use strict";

const { CreateSupportRequestCommand } = require("./commands/CreateSupportRequest/CreateSupportRequestCommand");
const { CreateSupportRequestHandler } = require("./commands/CreateSupportRequest/CreateSupportRequestHandler");
const { RespondToSupportRequestCommand } = require("./commands/RespondToSupportRequest/RespondToSupportRequestCommand");
const { RespondToSupportRequestHandler } = require("./commands/RespondToSupportRequest/RespondToSupportRequestHandler");
const { DeleteSupportRequestCommand } = require("./commands/DeleteSupportRequest/DeleteSupportRequestCommand");
const { DeleteSupportRequestHandler } = require("./commands/DeleteSupportRequest/DeleteSupportRequestHandler");
const { ListSupportRequestsQuery } = require("./queries/ListSupportRequests/ListSupportRequestsQuery");
const { ListSupportRequestsHandler } = require("./queries/ListSupportRequests/ListSupportRequestsHandler");
const { GetSupportRequestQuery } = require("./queries/GetSupportRequest/GetSupportRequestQuery");
const { GetSupportRequestHandler } = require("./queries/GetSupportRequest/GetSupportRequestHandler");

module.exports = {
  CreateSupportRequestCommand,
  RespondToSupportRequestCommand,
  DeleteSupportRequestCommand,
  ListSupportRequestsQuery,
  GetSupportRequestQuery,
  commandHandlers: [
    [CreateSupportRequestCommand, CreateSupportRequestHandler],
    [RespondToSupportRequestCommand, RespondToSupportRequestHandler],
    [DeleteSupportRequestCommand, DeleteSupportRequestHandler]
  ],
  queryHandlers: [
    [ListSupportRequestsQuery, ListSupportRequestsHandler],
    [GetSupportRequestQuery, GetSupportRequestHandler]
  ]
};
