import { LOCAL_GATEWAY_COMPATIBILITY_PROFILES } from "./compatibility.js";
import { THIN_CAPABILITY_ADAPTERS } from "./adapters.js";
import { createConfiguredRaxFacade, createRaxFacade } from "./facade.js";
import { CapabilityRouter } from "./router.js";

export const defaultCapabilityRouter = new CapabilityRouter(
  THIN_CAPABILITY_ADAPTERS
);

export const rax = createRaxFacade(defaultCapabilityRouter);

export const localGatewayCapabilityRouter = new CapabilityRouter(
  THIN_CAPABILITY_ADAPTERS
);

export const raxLocal = createConfiguredRaxFacade(
  localGatewayCapabilityRouter,
  LOCAL_GATEWAY_COMPATIBILITY_PROFILES
);
