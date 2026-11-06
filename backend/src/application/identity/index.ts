"use strict";

import { defineContext } from "../shared/registry";
import authPolicy from "./authPolicy";

const context = defineContext({
  name: "identity",
  commands: {
    RegisterUser: require("./commands/RegisterUser"),
    SignIn: require("./commands/SignIn"),
    SignOut: require("./commands/SignOut"),
    Authorize: require("./commands/Authorize"),
    CompleteAuthorization: require("./commands/CompleteAuthorization"),
    ExchangeToken: require("./commands/ExchangeToken"),
    RevokeToken: require("./commands/RevokeToken"),
    ChangePassword: require("./commands/ChangePassword"),
    RequestPasswordReset: require("./commands/RequestPasswordReset"),
    ResetPassword: require("./commands/ResetPassword"),
    VerifyEmail: require("./commands/VerifyEmail"),
    UpdateProfile: require("./commands/UpdateProfile"),
    SaveAddress: require("./commands/SaveAddress"),
    DeleteAddress: require("./commands/DeleteAddress"),
    AssignRole: require("./commands/AssignRole"),
    SetUserStatus: require("./commands/SetUserStatus")
  },
  queries: {
    GetAuthorizationRequest: require("./queries/GetAuthorizationRequest"),
    ResolveAccessPolicy: require("./queries/ResolveAccessPolicy"),
    GetCurrentUser: require("./queries/GetCurrentUser"),
    ListUsers: require("./queries/ListUsers"),
    ListAddresses: require("./queries/ListAddresses")
  }
});

/*
 * Oturum ve jeton süreleri: presentation katmanı çerez ömrünü bunlardan okur,
 * bağlamın iç dosyalarına uzanmadan.
 */
export = { ...context, authPolicy };
