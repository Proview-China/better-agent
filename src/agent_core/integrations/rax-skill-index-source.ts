import { access } from "node:fs/promises";
import path from "node:path";

import { rax } from "../../rax/runtime.js";
import type { SkillDescriptor } from "../../rax/index.js";
import type { CoreOverlayIndexEntryV1 } from "../core-prompt/types.js";

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function scoreSkillDescriptor(descriptor: SkillDescriptor, objective: string): number {
  const haystack = [
    descriptor.name,
    descriptor.description,
    ...(descriptor.tags ?? []),
    ...(descriptor.triggers ?? []),
  ].join(" ").toLowerCase();
  const tokens = objective
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function toSkillOverlayEntry(descriptor: SkillDescriptor): CoreOverlayIndexEntryV1 {
  return {
    id: `skill:${descriptor.id}`,
    label: descriptor.name,
    summary: descriptor.description,
    bodyRef: descriptor.source.entryPath
      ? `skill-body:${descriptor.source.entryPath}`
      : undefined,
  };
}

export async function discoverLiveSkillOverlayEntries(input: {
  cwd: string;
  objective: string;
  limit?: number;
}): Promise<CoreOverlayIndexEntryV1[]> {
  const candidateSources = [
    path.join(input.cwd, ".codex", "skills"),
    path.join(process.env.HOME ?? "", ".codex", "skills"),
  ].filter((entry) => entry.length > 0);

  const sources: string[] = [];
  for (const entry of candidateSources) {
    if (await pathExists(entry)) {
      sources.push(entry);
    }
  }
  if (sources.length === 0) {
    return [];
  }

  const descriptors = await rax.skill.discover({ sources });
  const ranked = descriptors
    .map((descriptor) => ({
      descriptor,
      score: scoreSkillDescriptor(descriptor, input.objective),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.descriptor.name.localeCompare(right.descriptor.name, "en");
    })
    .slice(0, input.limit ?? 6)
    .map(({ descriptor }) => toSkillOverlayEntry(descriptor));

  return ranked;
}
