"use strict";

import { defineContext } from "../shared/registry";

export = defineContext({
  name: "system",
  commands: {},
  queries: {
    CheckReadiness: require("./queries/CheckReadiness"),
    GetDashboard: require("./queries/GetDashboard")
  }
});
