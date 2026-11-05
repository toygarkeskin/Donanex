"use strict";

const { CheckReadinessQuery } = require("./queries/CheckReadiness/CheckReadinessQuery");
const { CheckReadinessHandler } = require("./queries/CheckReadiness/CheckReadinessHandler");

module.exports = {
  CheckReadinessQuery,
  commandHandlers: [],
  queryHandlers: [[CheckReadinessQuery, CheckReadinessHandler]]
};
