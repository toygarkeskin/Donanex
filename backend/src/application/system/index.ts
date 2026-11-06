"use strict";

import { defineContext } from "../shared/registry";

import * as CheckReadiness from "./queries/CheckReadiness";
import * as GetDashboard from "./queries/GetDashboard";

export = defineContext({
  name: "system",
  commands: {},
  queries: {
    CheckReadiness,
    GetDashboard,
  }
});
