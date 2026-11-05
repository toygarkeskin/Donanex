"use strict";

const { defineContext } = require("../shared/registry");

module.exports = defineContext({
  name: "system",
  commands: {},
  queries: {
    CheckReadiness: require("./queries/CheckReadiness"),
    GetDashboard: require("./queries/GetDashboard")
  }
});
