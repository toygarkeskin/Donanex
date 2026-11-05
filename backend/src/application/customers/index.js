"use strict";

const { RegisterCustomerCommand } = require("./commands/RegisterCustomer/RegisterCustomerCommand");
const { RegisterCustomerHandler } = require("./commands/RegisterCustomer/RegisterCustomerHandler");
const { LoginCustomerCommand } = require("./commands/LoginCustomer/LoginCustomerCommand");
const { LoginCustomerHandler } = require("./commands/LoginCustomer/LoginCustomerHandler");
const { SaveCustomerAddressCommand } = require("./commands/SaveCustomerAddress/SaveCustomerAddressCommand");
const { SaveCustomerAddressHandler } = require("./commands/SaveCustomerAddress/SaveCustomerAddressHandler");
const { UpdateCustomerProfileCommand } = require("./commands/UpdateCustomerProfile/UpdateCustomerProfileCommand");
const { UpdateCustomerProfileHandler } = require("./commands/UpdateCustomerProfile/UpdateCustomerProfileHandler");
const { ChangeCustomerPasswordCommand } = require("./commands/ChangeCustomerPassword/ChangeCustomerPasswordCommand");
const { ChangeCustomerPasswordHandler } = require("./commands/ChangeCustomerPassword/ChangeCustomerPasswordHandler");
const { RequestPasswordResetCommand } = require("./commands/RequestPasswordReset/RequestPasswordResetCommand");
const { RequestPasswordResetHandler } = require("./commands/RequestPasswordReset/RequestPasswordResetHandler");
const { ResetPasswordCommand } = require("./commands/ResetPassword/ResetPasswordCommand");
const { ResetPasswordHandler } = require("./commands/ResetPassword/ResetPasswordHandler");
const { GetCustomerProfileQuery } = require("./queries/GetCustomerProfile/GetCustomerProfileQuery");
const { GetCustomerProfileHandler } = require("./queries/GetCustomerProfile/GetCustomerProfileHandler");
const { GetCustomerAddressQuery } = require("./queries/GetCustomerAddress/GetCustomerAddressQuery");
const { GetCustomerAddressHandler } = require("./queries/GetCustomerAddress/GetCustomerAddressHandler");

module.exports = {
  RegisterCustomerCommand,
  LoginCustomerCommand,
  SaveCustomerAddressCommand,
  UpdateCustomerProfileCommand,
  ChangeCustomerPasswordCommand,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  GetCustomerProfileQuery,
  GetCustomerAddressQuery,
  commandHandlers: [
    [RegisterCustomerCommand, RegisterCustomerHandler],
    [LoginCustomerCommand, LoginCustomerHandler],
    [SaveCustomerAddressCommand, SaveCustomerAddressHandler],
    [UpdateCustomerProfileCommand, UpdateCustomerProfileHandler],
    [ChangeCustomerPasswordCommand, ChangeCustomerPasswordHandler],
    [RequestPasswordResetCommand, RequestPasswordResetHandler],
    [ResetPasswordCommand, ResetPasswordHandler]
  ],
  queryHandlers: [
    [GetCustomerProfileQuery, GetCustomerProfileHandler],
    [GetCustomerAddressQuery, GetCustomerAddressHandler]
  ]
};
