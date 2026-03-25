import { createTapFormalFamilyInventory } from "./formal-family-inventory.js";
import type { TapAvailabilityFamilyKey } from "./availability-types.js";

export const TAP_BACKLOG_PRIORITY_LEVELS = [
  "critical_path",
  "high",
  "medium",
] as const;
export type TapBacklogPriorityLevel =
  (typeof TAP_BACKLOG_PRIORITY_LEVELS)[number];

export const TAP_BACKLOG_ENTRY_KINDS = [
  "capability",
  "runtime_thick_family",
] as const;
export type TapBacklogEntryKind =
  (typeof TAP_BACKLOG_ENTRY_KINDS)[number];

export interface TapBacklogAuditEntry {
  capabilityKey: string;
  kind: TapBacklogEntryKind;
  familyKey: "pending_closure" | "runtime_thick";
  priority: TapBacklogPriorityLevel;
  cannotBeFormalBecause: string[];
  recommendedNextSteps: string[];
  blockingDependencies: string[];
  notes?: string[];
}

export interface TapBacklogPrioritySummary {
  priority: TapBacklogPriorityLevel;
  capabilityKeys: string[];
  count: number;
}

export interface TapBacklogCapabilityAudit {
  generatedAt: string;
  formalFamilyKeys: TapAvailabilityFamilyKey[];
  formalCapabilityKeys: string[];
  entries: TapBacklogAuditEntry[];
  overlapsWithFormalCapabilities: string[];
  prioritySummary: TapBacklogPrioritySummary[];
}

function createPendingClosureEntries(): TapBacklogAuditEntry[] {
  return [
    {
      capabilityKey: "dependency.install",
      kind: "capability",
      familyKey: "pending_closure",
      priority: "critical_path",
      cannotBeFormalBecause: [
        "缺少正式 capability package 与 register helper。",
        "外部副作用强，当前还没有稳定的 install / rollback / evidence 口径。",
        "尚未接入 TAP 的 production-like gating 与 human gate 策略。",
      ],
      recommendedNextSteps: [
        "先补 formal capability package 和 verification contract。",
        "补安装前置检查、rollback 和 evidence 输出。",
        "再接入 extended TMA / reviewer 审批链。",
      ],
      blockingDependencies: [
        "Wave 3 failure taxonomy",
        "Wave 3 availability gating",
      ],
    },
    {
      capabilityKey: "network.download",
      kind: "capability",
      familyKey: "pending_closure",
      priority: "high",
      cannotBeFormalBecause: [
        "还没有正式的 provider / source trust policy。",
        "当前没有 download artifact 的统一 evidence 与 quarantine 口径。",
        "外部网络副作用尚未接入 TAP 的严格 gating。",
      ],
      recommendedNextSteps: [
        "补 source/trust/evidence contract。",
        "把下载结果纳入 rollback / cleanup 生命周期。",
        "再接 reviewer / human gate 决策。",
      ],
      blockingDependencies: [
        "Wave 3 failure taxonomy",
        "memory/context-aware review",
      ],
    },
    {
      capabilityKey: "mcp.configure",
      kind: "capability",
      familyKey: "pending_closure",
      priority: "critical_path",
      cannotBeFormalBecause: [
        "会改 MCP 配置与连接形态，副作用高于当前 mcp read/call family。",
        "还没有配置变更的 activation / replace / rollback 闭环。",
        "尚未区分 build/configure 与 execute 的治理边界。",
      ],
      recommendedNextSteps: [
        "补配置变更类 capability package。",
        "补 config diff / rollback / verification contract。",
        "接入 tool_reviewer / TMA durable 主链。",
      ],
      blockingDependencies: [
        "tool_reviewer durable closure",
        "activation / replay / recovery closure",
      ],
    },
    {
      capabilityKey: "system.write",
      kind: "capability",
      familyKey: "pending_closure",
      priority: "critical_path",
      cannotBeFormalBecause: [
        "系统级写入超出当前 workspace-only tooling baseline。",
        "缺少 destructive side effects 的强约束与人工升级路径。",
        "没有系统级 rollback / recovery / ownership contract。",
      ],
      recommendedNextSteps: [
        "单独定义 system.write family，而不是混在 repo.write 里。",
        "补 human gate 升级、ownership 和 rollback 机制。",
        "默认保持 blocked，直到严格治理闭环成立。",
      ],
      blockingDependencies: [
        "Wave 3 availability gating",
        "Wave 4-5 human gate durability",
      ],
    },
  ];
}

function createRuntimeThickEntries(): TapBacklogAuditEntry[] {
  return [
    {
      capabilityKey: "session.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "medium",
      cannotBeFormalBecause: [
        "当前更偏 runtime 内部语义，不是已冻结的 capability package。",
        "缺少面向 TAP 的独立 verification 和 evidence contract。",
      ],
      recommendedNextSteps: [
        "先明确是否真的暴露为 capability family。",
        "如果暴露，再补 package / gating / evidence。",
      ],
      blockingDependencies: ["runtime assembly stabilization"],
    },
    {
      capabilityKey: "memory.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "high",
      cannotBeFormalBecause: [
        "依赖未来的 memory/context pool，不是当前 TAP 单独能收口的能力。",
        "缺少 context aperture、retention、evidence 的正式契约。",
      ],
      recommendedNextSteps: [
        "等待 memory/context pool 设计冻结。",
        "之后按 pool-compatible 模式接成独立 family。",
      ],
      blockingDependencies: ["memory pool", "context management pool"],
    },
    {
      capabilityKey: "agent.handoff",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "high",
      cannotBeFormalBecause: [
        "牵涉多 agent 交接协议和 durable session re-entry。",
        "当前 reviewer/tool_reviewer/TMA 自身 durable closure 还没完成。",
      ],
      recommendedNextSteps: [
        "先完成三角色 durable closure。",
        "再把 handoff 做成统一 runtime-thick family。",
      ],
      blockingDependencies: ["reviewer/tool_reviewer/TMA durable closure"],
    },
    {
      capabilityKey: "subagent.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "high",
      cannotBeFormalBecause: [
        "涉及并发 agent budget、ownership 和 recursion guard。",
        "当前还没有统一的 subagent governance contract。",
      ],
      recommendedNextSteps: [
        "补 subagent budget / ownership / recursion policy。",
        "再考虑是否 formalize 为 family。",
      ],
      blockingDependencies: ["governance policy"],
    },
    {
      capabilityKey: "guardrail.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "high",
      cannotBeFormalBecause: [
        "guardrail 更像横切治理层，不是单个 capability package。",
        "需要和 failure taxonomy / gating 一起冻结。",
      ],
      recommendedNextSteps: [
        "先完成 Wave 3 taxonomy 与 gating。",
        "之后再看是否抽成独立 family。",
      ],
      blockingDependencies: ["Wave 3 failure taxonomy", "Wave 3 availability gating"],
    },
    {
      capabilityKey: "trace.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "medium",
      cannotBeFormalBecause: [
        "trace 仍偏内部观察面，缺少对外 capability contract。",
      ],
      recommendedNextSteps: [
        "先定义 trace evidence schema。",
        "再考虑是否 formalize 为可申请能力。",
      ],
      blockingDependencies: ["evidence schema"],
    },
    {
      capabilityKey: "callback.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "medium",
      cannotBeFormalBecause: [
        "callback 需要稳定的 async resume / retry / recovery 语义。",
        "目前 durable replay 链还未收口。",
      ],
      recommendedNextSteps: [
        "先补 activation / replay / recovery。",
        "之后再定义 callback family。",
      ],
      blockingDependencies: ["Wave 5 recovery closure"],
    },
    {
      capabilityKey: "computer.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "high",
      cannotBeFormalBecause: [
        "副作用高且常与 external/mcp/computer-use 绑定。",
        "当前没有足够强的 human gate 和 safety contract。",
      ],
      recommendedNextSteps: [
        "先完成高危行为 gating。",
        "再拆 computer family 的细粒度 contract。",
      ],
      blockingDependencies: ["human gate durability", "safety policy"],
    },
    {
      capabilityKey: "code.*",
      kind: "runtime_thick_family",
      familyKey: "runtime_thick",
      priority: "medium",
      cannotBeFormalBecause: [
        "当前 code.read / repo.write 已经分散在 formal family 里，厚 code family 语义未冻结。",
        "还没有决定哪些能力该保留为薄能力，哪些要升级为厚 family。",
      ],
      recommendedNextSteps: [
        "先完成 current formal families 的 production closure。",
        "再重整 code-thick family 的边界。",
      ],
      blockingDependencies: ["formal family closure"],
    },
  ];
}

function summarizePriorities(entries: readonly TapBacklogAuditEntry[]): TapBacklogPrioritySummary[] {
  return TAP_BACKLOG_PRIORITY_LEVELS.map((priority) => {
    const selected = entries.filter((entry) => entry.priority === priority);
    return {
      priority,
      capabilityKeys: selected.map((entry) => entry.capabilityKey),
      count: selected.length,
    };
  });
}

export function createBacklogCapabilityAudit(
  now: () => Date = () => new Date(),
): TapBacklogCapabilityAudit {
  const formalInventory = createTapFormalFamilyInventory();
  const formalCapabilityKeys = formalInventory.capabilityKeys;
  const entries = [
    ...createPendingClosureEntries(),
    ...createRuntimeThickEntries(),
  ];
  const overlapsWithFormalCapabilities = entries
    .map((entry) => entry.capabilityKey)
    .filter((capabilityKey) => formalCapabilityKeys.includes(capabilityKey));

  return {
    generatedAt: now().toISOString(),
    formalFamilyKeys: [...formalInventory.familyKeys],
    formalCapabilityKeys: [...formalCapabilityKeys],
    entries,
    overlapsWithFormalCapabilities,
    prioritySummary: summarizePriorities(entries),
  };
}
