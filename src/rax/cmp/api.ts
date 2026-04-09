import { randomUUID } from "node:crypto";

import type { RaxCmpConfig } from "../cmp-config.js";
import type { RaxCmpApi, RaxCmpPort } from "../cmp-types.js";
import { createRaxCmpFlowApi } from "./flow.js";
import { createRaxCmpProjectApi } from "./project.js";
import { createRaxCmpRolesApi } from "./roles.js";
import { createRaxCmpSessionApi } from "./session.js";

export interface CreateRaxCmpFacadeInput {
  runtimeFactory?: (config: RaxCmpConfig) => RaxCmpPort;
  now?: () => Date;
  sessionIdFactory?: () => string;
}

export function createRaxCmpFacade(input: CreateRaxCmpFacadeInput = {}): RaxCmpApi {
  return {
    session: createRaxCmpSessionApi({
      runtimeFactory: input.runtimeFactory,
      now: input.now,
      sessionIdFactory: input.sessionIdFactory ?? randomUUID,
    }),
    project: createRaxCmpProjectApi(),
    flow: createRaxCmpFlowApi(),
    roles: createRaxCmpRolesApi(),
  };
}

export type {
  RaxCmpApi,
  RaxCmpFlowApi,
  RaxCmpProjectApi,
  RaxCmpRolesApi,
  RaxCmpSessionApi,
} from "../cmp-types.js";
