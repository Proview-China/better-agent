import {
  createAgentCapabilityProfile,
  type AgentCapabilityProfile,
  type CreateAgentCapabilityProfileInput,
} from "../ta-pool-types/ta-pool-profile.js";

export const TAP_REVIEWER_BASELINE_CAPABILITY_KEYS = [
  "code.read",
  "docs.read",
] as const;

export const TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS = [
  "code.read",
  "docs.read",
  "repo.write",
  "spreadsheet.write",
  "doc.write",
  "code.edit",
  "code.patch",
  "shell.restricted",
  "shell.session",
  "git.status",
  "git.diff",
  "git.commit",
  "git.push",
  "code.diff",
  "browser.playwright",
  "test.run",
  "write_todos",
  "skill.doc.generate",
] as const;

export const TAP_EXTENDED_TMA_EXTRA_CAPABILITY_KEYS = [
  "dependency.install",
  "mcp.configure",
  "network.download",
  "system.write",
] as const;

export const TAP_EXTENDED_TMA_BASELINE_CAPABILITY_KEYS = [
  ...TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS,
  ...TAP_EXTENDED_TMA_EXTRA_CAPABILITY_KEYS,
] as const;

export const TAP_REVIEWER_DENIED_EXECUTION_PATTERNS = [
  "repo.write",
  "spreadsheet.write",
  "doc.write",
  "code.edit",
  "code.patch",
  "shell.*",
  "git.*",
  "browser.*",
  "test.run",
  "write_todos",
  "skill.doc.generate",
  "dependency.install",
  "mcp.configure",
  "network.download",
  "system.write",
] as const;

type ProfileOverrides = Omit<
  Partial<CreateAgentCapabilityProfileInput>,
  "baselineCapabilities" | "deniedCapabilityPatterns" | "allowedCapabilityPatterns"
>;

export function createTapReviewerProfile(
  overrides: ProfileOverrides = {},
): AgentCapabilityProfile {
  return createAgentCapabilityProfile({
    profileId: overrides.profileId ?? "tap-reviewer",
    agentClass: overrides.agentClass ?? "tap-reviewer",
    defaultMode: overrides.defaultMode ?? "standard",
    baselineTier: overrides.baselineTier ?? "B0",
    baselineCapabilities: [...TAP_REVIEWER_BASELINE_CAPABILITY_KEYS],
    deniedCapabilityPatterns: [...TAP_REVIEWER_DENIED_EXECUTION_PATTERNS],
    notes: overrides.notes ?? "Reviewer stays read-only and does not receive execution capabilities.",
    metadata: {
      baselineFamily: "tap-reviewer",
      baselineVersion: "v1",
      ...(overrides.metadata ?? {}),
    },
  });
}

export function createTapBootstrapTmaProfile(
  overrides: ProfileOverrides = {},
): AgentCapabilityProfile {
  return createAgentCapabilityProfile({
    profileId: overrides.profileId ?? "tap-bootstrap-tma",
    agentClass: overrides.agentClass ?? "tap-bootstrap-tma",
    defaultMode: overrides.defaultMode ?? "balanced",
    baselineTier: overrides.baselineTier ?? "B0",
    baselineCapabilities: [...TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS],
    notes: overrides.notes ?? "Bootstrap TMA can read, write bounded repo/doc/spreadsheet outputs, edit, patch, diff, inspect git state, automate a bounded local browser, run restricted shell or shell sessions, run tests, manage todos, and generate repo-local docs.",
    metadata: {
      baselineFamily: "tap-bootstrap-tma",
      baselineVersion: "v1",
      ...(overrides.metadata ?? {}),
    },
  });
}

export function createTapExtendedTmaProfile(
  overrides: ProfileOverrides = {},
): AgentCapabilityProfile {
  return createAgentCapabilityProfile({
    profileId: overrides.profileId ?? "tap-extended-tma",
    agentClass: overrides.agentClass ?? "tap-extended-tma",
    defaultMode: overrides.defaultMode ?? "balanced",
    baselineTier: overrides.baselineTier ?? "B1",
    baselineCapabilities: [...TAP_EXTENDED_TMA_BASELINE_CAPABILITY_KEYS],
    notes: overrides.notes ?? "Extended TMA adds install, network, MCP, and system preparation over the bootstrap read/write/test/doc baseline.",
    metadata: {
      baselineFamily: "tap-extended-tma",
      baselineVersion: "v1",
      ...(overrides.metadata ?? {}),
    },
  });
}
