import type { CapabilityAdapterDescriptor } from "./contracts.js";
import { ANTHROPIC_AGENT_ADAPTERS } from "../integrations/anthropic/agent/index.js";
import { ANTHROPIC_API_ADAPTERS } from "../integrations/anthropic/api/index.js";
import { deepMindApiCapabilityDescriptors } from "../integrations/deepmind/api/index.js";
import { openAIApiThinCapabilityDescriptors } from "../integrations/openai/api/index.js";

export const THIN_CAPABILITY_ADAPTERS: readonly CapabilityAdapterDescriptor[] = [
  ...openAIApiThinCapabilityDescriptors,
  ...ANTHROPIC_AGENT_ADAPTERS,
  ...ANTHROPIC_API_ADAPTERS,
  ...deepMindApiCapabilityDescriptors
];
