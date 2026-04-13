import { createTapFormalFamilyInventory } from "../tap-availability/formal-family-inventory.js";
import { loadClaudeCodeSkillOverlaySnapshot } from "../integrations/claudecode-skill-overlay-source.js";
import { loadRepoMemoryOverlaySnapshot } from "../integrations/repo-memory-overlay-source.js";
import { createMemoryOverlayIndexEntries } from "./memory-overlay-index-producer.js";
import { createSkillOverlayIndexEntries } from "./skill-overlay-index-producer.js";
import type {
  CoreOverlayIndexEntryV1,
  CoreOverlayIndexV1,
} from "./types.js";

function createCapabilityFamilyEntries(
  capabilityUsageIndexText?: string,
): CoreOverlayIndexEntryV1[] {
  const capabilityUsageIndex = capabilityUsageIndexText?.trim();
  if (!capabilityUsageIndex) {
    return [];
  }
  return [
    {
      id: "tap-capability-usage-index",
      label: "TAP capability usage index",
      summary: capabilityUsageIndex,
      bodyRef: "tap-capability-usage-index",
    },
  ];
}

function createFallbackSkillEntries(): CoreOverlayIndexEntryV1[] {
  const skillFamily = createTapFormalFamilyInventory()
    .families
    .find((family) => family.familyKey === "skill");
  if (!skillFamily) {
    return [];
  }
  return skillFamily.entries.slice(0, 6).map((entry) => ({
    id: `skill:${entry.capabilityKey}`,
    label: entry.capabilityKey,
    summary: entry.manifest.description || `Governed skill capability ${entry.capabilityKey}`,
    bodyRef: `skill-body:${entry.capabilityKey}`,
  }));
}

function createSkillEntries(userMessage: string): CoreOverlayIndexEntryV1[] {
  const snapshotEntries = createSkillOverlayIndexEntries({
    userMessage,
    snapshot: loadClaudeCodeSkillOverlaySnapshot(),
  });
  return snapshotEntries.length > 0 ? snapshotEntries : createFallbackSkillEntries();
}

function mergeSkillEntries(
  preferred: CoreOverlayIndexEntryV1[],
  fallback: CoreOverlayIndexEntryV1[],
): CoreOverlayIndexEntryV1[] {
  const merged = new Map<string, CoreOverlayIndexEntryV1>();
  for (const entry of preferred) {
    merged.set(entry.id, entry);
  }
  for (const entry of fallback) {
    if (!merged.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  }
  return [...merged.values()].slice(0, 6);
}

function createMemoryEntries(input: { userMessage: string }): CoreOverlayIndexEntryV1[] {
  return createMemoryOverlayIndexEntries({
    userMessage: input.userMessage,
    snapshot: loadRepoMemoryOverlaySnapshot(),
  });
}

export function createLiveChatOverlayIndex(input: {
  userMessage: string;
  capabilityUsageIndexText?: string;
  skillEntries?: CoreOverlayIndexEntryV1[];
  memoryEntries?: CoreOverlayIndexEntryV1[];
  includeSkillIndex?: boolean;
  includeMemoryIndex?: boolean;
}): CoreOverlayIndexV1 | undefined {
  const capabilityFamilies = createCapabilityFamilyEntries(input.capabilityUsageIndexText);
  const defaultSkillEntries = createSkillEntries(input.userMessage);
  const skills = input.includeSkillIndex === false
    ? []
    : input.skillEntries && input.skillEntries.length > 0
      ? mergeSkillEntries(input.skillEntries, defaultSkillEntries)
      : defaultSkillEntries;
  const defaultMemoryEntries = createMemoryEntries({
    userMessage: input.userMessage,
  });
  const memories = input.includeMemoryIndex === false
    ? []
    : input.memoryEntries && input.memoryEntries.length > 0
      ? input.memoryEntries.slice(0, 6)
      : defaultMemoryEntries;

  if (capabilityFamilies.length === 0 && skills.length === 0 && memories.length === 0) {
    return undefined;
  }

  return {
    schemaVersion: "core-overlay-index/v1",
    capabilityFamilies: capabilityFamilies.length > 0 ? capabilityFamilies : undefined,
    skills: skills.length > 0 ? skills : undefined,
    memories: memories.length > 0 ? memories : undefined,
  };
}
