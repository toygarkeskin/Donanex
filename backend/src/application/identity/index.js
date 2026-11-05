"use strict";

const { LoginAdminCommand } = require("./commands/LoginAdmin/LoginAdminCommand");
const { LoginAdminHandler } = require("./commands/LoginAdmin/LoginAdminHandler");
const { RevokeSessionCommand } = require("./commands/RevokeSession/RevokeSessionCommand");
const { RevokeSessionHandler } = require("./commands/RevokeSession/RevokeSessionHandler");
const { ResolveSessionsQuery } = require("./queries/ResolveSessions/ResolveSessionsQuery");
const { ResolveSessionsHandler } = require("./queries/ResolveSessions/ResolveSessionsHandler");
const { TOKEN_TYPES } = require("./sessionPolicy");

module.exports = {
  LoginAdminCommand,
  RevokeSessionCommand,
  ResolveSessionsQuery,
  TOKEN_TYPES,
  commandHandlers: [
    [LoginAdminCommand, LoginAdminHandler],
    [RevokeSessionCommand, RevokeSessionHandler]
  ],
  queryHandlers: [[ResolveSessionsQuery, ResolveSessionsHandler]]
};
