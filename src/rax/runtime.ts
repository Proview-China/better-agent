import { LOCAL_GATEWAY_COMPATIBILITY_PROFILES } from "./compatibility.js";
import { THIN_CAPABILITY_ADAPTERS } from "./adapters.js";
import { createConfiguredRaxFacade, createRaxFacade } from "./facade.js";
import { McpRuntime } from "./mcp-runtime.js";
import { CapabilityRouter } from "./router.js";
import { SkillRuntime } from "./skill-runtime.js";

export const defaultCapabilityRouter = new CapabilityRouter(
  THIN_CAPABILITY_ADAPTERS
);

export const defaultMcpRuntime = new McpRuntime();
export const defaultSkillRuntime = new SkillRuntime();

export const rax = createRaxFacade(
  defaultCapabilityRouter,
  undefined,
  defaultMcpRuntime,
  undefined,
  defaultSkillRuntime
);

export const localGatewayCapabilityRouter = new CapabilityRouter(
  THIN_CAPABILITY_ADAPTERS
);

export const localGatewayMcpRuntime = new McpRuntime();
export const localGatewaySkillRuntime = new SkillRuntime();

export const raxLocal = createConfiguredRaxFacade(
  localGatewayCapabilityRouter,
  LOCAL_GATEWAY_COMPATIBILITY_PROFILES,
  localGatewayMcpRuntime,
  undefined,
  localGatewaySkillRuntime
);
