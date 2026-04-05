import {
  createCmpFiveAgentTapProfileCatalog,
  type CmpFiveAgentTapProfileSummaryCatalog,
} from "./configuration.js";
import { CMP_FIVE_AGENT_ROLES } from "./shared.js";

export function createCmpFiveAgentTapProfileSummaryCatalog(): CmpFiveAgentTapProfileSummaryCatalog {
  const catalog = createCmpFiveAgentTapProfileCatalog();
  return CMP_FIVE_AGENT_ROLES.reduce<CmpFiveAgentTapProfileSummaryCatalog>((accumulator, role) => {
    const profile = catalog[role];
    accumulator[role] = {
      role,
      profileId: profile.profileId,
      agentClass: profile.agentClass,
      defaultMode: profile.defaultMode,
      baselineTier: profile.baselineTier,
      baselineCapabilities: [...(profile.baselineCapabilities ?? [])],
      allowedCapabilityPatterns: [...(profile.allowedCapabilityPatterns ?? [])],
      deniedCapabilityPatterns: [...(profile.deniedCapabilityPatterns ?? [])],
    };
    return accumulator;
  }, {
    icma: {
      role: "icma",
      profileId: "",
      agentClass: "",
      defaultMode: "",
      baselineTier: "",
      baselineCapabilities: [],
      allowedCapabilityPatterns: [],
      deniedCapabilityPatterns: [],
    },
    iterator: {
      role: "iterator",
      profileId: "",
      agentClass: "",
      defaultMode: "",
      baselineTier: "",
      baselineCapabilities: [],
      allowedCapabilityPatterns: [],
      deniedCapabilityPatterns: [],
    },
    checker: {
      role: "checker",
      profileId: "",
      agentClass: "",
      defaultMode: "",
      baselineTier: "",
      baselineCapabilities: [],
      allowedCapabilityPatterns: [],
      deniedCapabilityPatterns: [],
    },
    dbagent: {
      role: "dbagent",
      profileId: "",
      agentClass: "",
      defaultMode: "",
      baselineTier: "",
      baselineCapabilities: [],
      allowedCapabilityPatterns: [],
      deniedCapabilityPatterns: [],
    },
    dispatcher: {
      role: "dispatcher",
      profileId: "",
      agentClass: "",
      defaultMode: "",
      baselineTier: "",
      baselineCapabilities: [],
      allowedCapabilityPatterns: [],
      deniedCapabilityPatterns: [],
    },
  });
}
