export const CMP_SECTION_KINDS = [
  "runtime_context",
  "historical_context",
  "task_seed",
  "peer_signal",
  "promotion_signal"
] as const;
export type CmpSectionKind = (typeof CMP_SECTION_KINDS)[number];

export const CMP_SECTION_SOURCES = [
  "core_agent",
  "dispatcher",
  "parent_agent",
  "peer_agent",
  "child_agent",
  "system"
] as const;
export type CmpSectionSource = (typeof CMP_SECTION_SOURCES)[number];

export const CMP_SECTION_FIDELITY = [
  "exact",
  "checked",
  "projected"
] as const;
export type CmpSectionFidelity = (typeof CMP_SECTION_FIDELITY)[number];

export const CMP_STORED_SECTION_PLANES = [
  "git",
  "postgresql",
  "redis"
] as const;
export type CmpStoredSectionPlane = (typeof CMP_STORED_SECTION_PLANES)[number];

export const CMP_STORED_SECTION_STATES = [
  "stored",
  "checked",
  "promoted",
  "dispatched",
  "archived"
] as const;
export type CmpStoredSectionState = (typeof CMP_STORED_SECTION_STATES)[number];

export const CMP_RULE_ACTIONS = [
  "accept",
  "store",
  "promote",
  "dispatch",
  "defer",
  "drop"
] as const;
export type CmpRuleAction = (typeof CMP_RULE_ACTIONS)[number];

export interface CmpSection {
  id: string;
  projectId: string;
  agentId: string;
  lineagePath: string[];
  source: CmpSectionSource;
  kind: CmpSectionKind;
  fidelity: CmpSectionFidelity;
  payloadRefs: string[];
  tags: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpStoredSection {
  id: string;
  projectId: string;
  agentId: string;
  sourceSectionId: string;
  plane: CmpStoredSectionPlane;
  storageRef: string;
  state: CmpStoredSectionState;
  visibility: "local" | "parent" | "peer" | "children" | "lineage";
  persistedAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRule {
  id: string;
  name: string;
  action: CmpRuleAction;
  priority: number;
  sectionKinds?: CmpSectionKind[];
  sources?: CmpSectionSource[];
  requiredTags?: string[];
  forbiddenTags?: string[];
  minFidelity?: CmpSectionFidelity;
  metadata?: Record<string, unknown>;
}

export interface CmpRulePack {
  id: string;
  name: string;
  rules: CmpRule[];
  metadata?: Record<string, unknown>;
}

export interface CmpRuleMatch {
  ruleId: string;
  ruleName: string;
  action: CmpRuleAction;
  priority: number;
}

export interface CmpRuleEvaluation {
  sectionId: string;
  packId: string;
  matches: CmpRuleMatch[];
  recommendedAction: CmpRuleAction;
  reasons: string[];
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function uniqueStrings(values: string[], label: string): string[] {
  const normalized = [...new Set(values.map((value) => assertNonEmpty(value, label)))];
  if (normalized.length === 0) {
    throw new Error(`${label} requires at least one non-empty string.`);
  }
  return normalized;
}

function fidelityIndex(value: CmpSectionFidelity): number {
  return CMP_SECTION_FIDELITY.indexOf(value);
}

export function createCmpSection(input: CmpSection): CmpSection {
  return {
    id: assertNonEmpty(input.id, "CMP section id"),
    projectId: assertNonEmpty(input.projectId, "CMP section projectId"),
    agentId: assertNonEmpty(input.agentId, "CMP section agentId"),
    lineagePath: uniqueStrings(input.lineagePath, "CMP section lineagePath"),
    source: input.source,
    kind: input.kind,
    fidelity: input.fidelity,
    payloadRefs: uniqueStrings(input.payloadRefs, "CMP section payloadRefs"),
    tags: [...new Set((input.tags ?? []).map((value) => value.trim()).filter(Boolean))],
    createdAt: assertNonEmpty(input.createdAt, "CMP section createdAt"),
    metadata: input.metadata
  };
}

export function createCmpStoredSection(input: CmpStoredSection): CmpStoredSection {
  return {
    id: assertNonEmpty(input.id, "CMP stored section id"),
    projectId: assertNonEmpty(input.projectId, "CMP stored section projectId"),
    agentId: assertNonEmpty(input.agentId, "CMP stored section agentId"),
    sourceSectionId: assertNonEmpty(input.sourceSectionId, "CMP stored section sourceSectionId"),
    plane: input.plane,
    storageRef: assertNonEmpty(input.storageRef, "CMP stored section storageRef"),
    state: input.state,
    visibility: input.visibility,
    persistedAt: assertNonEmpty(input.persistedAt, "CMP stored section persistedAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP stored section updatedAt"),
    metadata: input.metadata
  };
}

export function createCmpRule(input: CmpRule): CmpRule {
  if (!Number.isInteger(input.priority) || input.priority < 0) {
    throw new Error("CMP rule priority must be a non-negative integer.");
  }

  return {
    id: assertNonEmpty(input.id, "CMP rule id"),
    name: assertNonEmpty(input.name, "CMP rule name"),
    action: input.action,
    priority: input.priority,
    sectionKinds: input.sectionKinds ? [...new Set(input.sectionKinds)] : undefined,
    sources: input.sources ? [...new Set(input.sources)] : undefined,
    requiredTags: input.requiredTags
      ? [...new Set(input.requiredTags.map((value) => assertNonEmpty(value, "CMP rule requiredTag")))]
      : undefined,
    forbiddenTags: input.forbiddenTags
      ? [...new Set(input.forbiddenTags.map((value) => assertNonEmpty(value, "CMP rule forbiddenTag")))]
      : undefined,
    minFidelity: input.minFidelity,
    metadata: input.metadata
  };
}

export function createCmpRulePack(input: CmpRulePack): CmpRulePack {
  const rules = input.rules.map(createCmpRule).sort((left, right) => right.priority - left.priority);
  return {
    id: assertNonEmpty(input.id, "CMP rule pack id"),
    name: assertNonEmpty(input.name, "CMP rule pack name"),
    rules,
    metadata: input.metadata
  };
}

export function createCmpStoredSectionFromSection(input: {
  storedSectionId: string;
  section: CmpSection;
  plane: CmpStoredSectionPlane;
  storageRef: string;
  state?: CmpStoredSectionState;
  visibility?: CmpStoredSection["visibility"];
  persistedAt: string;
  metadata?: Record<string, unknown>;
}): CmpStoredSection {
  const section = createCmpSection(input.section);
  return createCmpStoredSection({
    id: input.storedSectionId,
    projectId: section.projectId,
    agentId: section.agentId,
    sourceSectionId: section.id,
    plane: input.plane,
    storageRef: input.storageRef,
    state: input.state ?? "stored",
    visibility: input.visibility ?? "local",
    persistedAt: input.persistedAt,
    updatedAt: input.persistedAt,
    metadata: {
      sectionKind: section.kind,
      sectionSource: section.source,
      sectionFidelity: section.fidelity,
      ...(input.metadata ?? {})
    }
  });
}

function ruleMatchesSection(rule: CmpRule, section: CmpSection): { matched: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (rule.sectionKinds && !rule.sectionKinds.includes(section.kind)) {
    return { matched: false, reasons };
  }
  if (rule.sources && !rule.sources.includes(section.source)) {
    return { matched: false, reasons };
  }
  if (rule.requiredTags && !rule.requiredTags.every((tag) => section.tags.includes(tag))) {
    return { matched: false, reasons };
  }
  if (rule.forbiddenTags && rule.forbiddenTags.some((tag) => section.tags.includes(tag))) {
    return { matched: false, reasons };
  }
  if (rule.minFidelity && fidelityIndex(section.fidelity) < fidelityIndex(rule.minFidelity)) {
    return { matched: false, reasons };
  }

  reasons.push(`Matched rule ${rule.name}.`);
  return { matched: true, reasons };
}

export function evaluateCmpRulePack(input: {
  pack: CmpRulePack;
  section: CmpSection;
}): CmpRuleEvaluation {
  const pack = createCmpRulePack(input.pack);
  const section = createCmpSection(input.section);

  const matches: CmpRuleMatch[] = [];
  const reasons: string[] = [];
  for (const rule of pack.rules) {
    const result = ruleMatchesSection(rule, section);
    if (!result.matched) {
      continue;
    }
    matches.push({
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      priority: rule.priority
    });
    reasons.push(...result.reasons);
  }

  const recommendedAction = matches[0]?.action ?? "defer";
  if (matches.length === 0) {
    reasons.push("No rule matched; defaulting to defer.");
  }

  return {
    sectionId: section.id,
    packId: pack.id,
    matches,
    recommendedAction,
    reasons
  };
}
