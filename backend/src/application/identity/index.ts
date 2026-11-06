"use strict";

import { defineContext } from "../shared/registry";
import authPolicy from "./authPolicy";

import * as RegisterUser from "./commands/RegisterUser";
import * as SignIn from "./commands/SignIn";
import * as SignOut from "./commands/SignOut";
import * as Authorize from "./commands/Authorize";
import * as CompleteAuthorization from "./commands/CompleteAuthorization";
import * as ExchangeToken from "./commands/ExchangeToken";
import * as RevokeToken from "./commands/RevokeToken";
import * as ChangePassword from "./commands/ChangePassword";
import * as RequestPasswordReset from "./commands/RequestPasswordReset";
import * as ResetPassword from "./commands/ResetPassword";
import * as VerifyEmail from "./commands/VerifyEmail";
import * as UpdateProfile from "./commands/UpdateProfile";
import * as SaveAddress from "./commands/SaveAddress";
import * as DeleteAddress from "./commands/DeleteAddress";
import * as AssignRole from "./commands/AssignRole";
import * as SetUserStatus from "./commands/SetUserStatus";
import * as GetAuthorizationRequest from "./queries/GetAuthorizationRequest";
import * as ResolveAccessPolicy from "./queries/ResolveAccessPolicy";
import * as GetCurrentUser from "./queries/GetCurrentUser";
import * as ListUsers from "./queries/ListUsers";
import * as ListAddresses from "./queries/ListAddresses";

const context = defineContext({
  name: "identity",
  commands: {
    RegisterUser,
    SignIn,
    SignOut,
    Authorize,
    CompleteAuthorization,
    ExchangeToken,
    RevokeToken,
    ChangePassword,
    RequestPasswordReset,
    ResetPassword,
    VerifyEmail,
    UpdateProfile,
    SaveAddress,
    DeleteAddress,
    AssignRole,
    SetUserStatus,
  },
  queries: {
    GetAuthorizationRequest,
    ResolveAccessPolicy,
    GetCurrentUser,
    ListUsers,
    ListAddresses,
  }
});

/*
 * Oturum ve jeton süreleri: presentation katmanı çerez ömrünü bunlardan okur,
 * bağlamın iç dosyalarına uzanmadan.
 */
export = { ...context, authPolicy };
