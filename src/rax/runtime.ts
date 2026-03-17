import { DEFAULT_COMPATIBILITY_PROFILES, LOCAL_GATEWAY_COMPATIBILITY_PROFILES } from "./compatibility.js";
import { THIN_CAPABILITY_ADAPTERS } from "./adapters.js";
import { createConfiguredRaxFacade } from "./facade.js";
import { McpNativeRuntime } from "./mcp-native-runtime.js";
import { McpRuntime } from "./mcp-runtime.js";
import { CapabilityRouter } from "./router.js";
import { SkillRuntime } from "./skill-runtime.js";

export const defaultCapabilityRouter = new CapabilityRouter(
  THIN_CAPABILITY_ADAPTERS
);

export const defaultMcpRuntime = new McpRuntime();
export const defaultMcpNativeRuntime = new McpNativeRuntime();
export const defaultSkillRuntime = new SkillRuntime();

export const rax = createConfiguredRaxFacade(
  defaultCapabilityRouter,
  DEFAULT_COMPATIBILITY_PROFILES,
  defaultMcpRuntime,
  undefined,
  defaultSkillRuntime,
  defaultMcpNativeRuntime
);

export const localGatewayCapabilityRouter = new CapabilityRouter(
  THIN_CAPABILITY_ADAPTERS
);

export const localGatewayMcpRuntime = new McpRuntime();
export const localGatewayMcpNativeRuntime = new McpNativeRuntime();
export const localGatewaySkillRuntime = new SkillRuntime();

export const raxLocal = createConfiguredRaxFacade(
  localGatewayCapabilityRouter,
  LOCAL_GATEWAY_COMPATIBILITY_PROFILES,
  localGatewayMcpRuntime,
  undefined,
  localGatewaySkillRuntime,
  localGatewayMcpNativeRuntime
);
