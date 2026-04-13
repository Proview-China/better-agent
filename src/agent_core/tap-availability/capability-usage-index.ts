import type { CapabilityPackageUsageExample } from "../capability-package/index.js";
import { createTapFormalFamilyInventory } from "./formal-family-inventory.js";
import type { TapAvailabilityFamilyKey, TapCapabilityAvailabilityReport } from "./availability-types.js";

export const TAP_HARDENED_CORE_INDEX_CAPABILITY_KEYS = [
  "code.read",
  "code.ls",
  "code.glob",
  "code.grep",
  "code.read_many",
  "code.symbol_search",
  "code.lsp",
  "docs.read",
  "read_pdf",
  "read_notebook",
  "view_image",
  "repo.write",
  "code.edit",
  "code.patch",
  "code.diff",
  "shell.restricted",
  "git.status",
  "git.diff",
  "git.commit",
  "git.push",
  "test.run",
  "shell.session",
  "skill.doc.generate",
  "write_todos",
  "search.web",
  "search.fetch",
  "search.ground",
  "mcp.listTools",
  "mcp.listResources",
  "mcp.readResource",
  "mp.search",
  "mp.resolve",
  "mp.history.request",
  "mp.materialize",
  "mp.promote",
  "mp.archive",
  "remote.exec",
  "tracker.create",
  "spreadsheet.read",
  "spreadsheet.write",
  "doc.read",
  "doc.write",
  "browser.playwright",
  "request_user_input",
  "request_permissions",
] as const;

export interface TapCapabilityUsageIndexEntry {
  capabilityKey: string;
  familyKey: TapAvailabilityFamilyKey;
  riskLevel: string;
  recommendedMode: string;
  usageDocRef: string;
  smokeEntry: string;
  healthEntry: string;
  supportRouteCount: number;
  coreHint: string;
  defaultNextAction?: string;
  bestPractices: string[];
  knownLimits: string[];
  exampleInvocation?: CapabilityPackageUsageExample;
  availabilityStatus?: string;
}

export interface TapCapabilityUsageIndex {
  generatedAt: string;
  entries: TapCapabilityUsageIndexEntry[];
}

const CORE_HINTS: Record<string, { coreHint: string; defaultNextAction?: string }> = {
  "code.read": {
    coreHint:
      "Use for repo-local source or build files when you need exact file facts. Prefer this after editing source/build files, not for docs or memory artifacts.",
    defaultNextAction: "summarize_code_facts",
  },
  "code.ls": {
    coreHint:
      "Use for quick directory discovery when you need structure, not file bodies. Prefer this before deeper read or grep steps.",
    defaultNextAction: "narrow_to_paths",
  },
  "code.glob": {
    coreHint:
      "Use for bounded path discovery by glob pattern. Prefer this when you already know the filename shape or extension family.",
    defaultNextAction: "read_matched_files",
  },
  "code.grep": {
    coreHint:
      "Use for bounded content search across repo code. Prefer this when you know a symbol fragment, string literal, or error text.",
    defaultNextAction: "inspect_hits",
  },
  "code.read_many": {
    coreHint:
      "Use for collecting a small batch of related files after ls, glob, or grep has narrowed the target set.",
    defaultNextAction: "summarize_cross_file_context",
  },
  "code.symbol_search": {
    coreHint:
      "Use for semantic symbol lookup before raw grep when the task is about a named function, type, or class.",
    defaultNextAction: "follow_symbol_definition",
  },
  "code.lsp": {
    coreHint:
      "Use for document_symbol, definition, references, or hover when you need code-intelligence facts instead of raw text search.",
    defaultNextAction: "report_symbol_navigation",
  },
  "docs.read": {
    coreHint:
      "Use for docs, markdown, and memory artifacts. Prefer this over code.read for docs/**, memory/**, and other text artifacts outside repo code scope.",
    defaultNextAction: "summarize_doc_facts",
  },
  "read_pdf": {
    coreHint:
      "Use for bounded PDF extraction when the source of truth is a PDF rather than markdown or code.",
    defaultNextAction: "report_pdf_excerpt",
  },
  "read_notebook": {
    coreHint:
      "Use for ipynb inspection when code, outputs, and markdown cells all matter together.",
    defaultNextAction: "summarize_notebook_cells",
  },
  "view_image": {
    coreHint:
      "Use for local image inspection when the user needs visible details from a file already on disk.",
    defaultNextAction: "report_visible_image_facts",
  },
  "repo.write": {
    coreHint:
      "Use for bounded repo-local file writes when you already know the target paths and desired contents. Pair each write with an immediate readback or diff check.",
    defaultNextAction: "verify_written_files",
  },
  "code.edit": {
    coreHint:
      "Use for exact text replacement or creating a small file. After editing docs or memory artifacts, prefer docs.read for readback; after editing source/build files, prefer code.read.",
    defaultNextAction: "route_readback_by_path_kind",
  },
  "code.patch": {
    coreHint:
      "Use for structured multi-file patches when exact edit blocks matter more than one-shot replace semantics. Keep hunks small and workspace-local.",
    defaultNextAction: "verify_patch_effects",
  },
  "code.diff": {
    coreHint:
      "Use for a bounded diff between two explicit file states or revisions when the user needs exact textual change evidence.",
    defaultNextAction: "summarize_diff_hunks",
  },
  "shell.restricted": {
    coreHint:
      "Use for one-shot workspace-scoped commands such as build, test, or fact gathering. Prefer this over shell.session unless the task truly needs an interactive process.",
    defaultNextAction: "inspect_command_result",
  },
  "git.status": {
    coreHint:
      "Use to inspect current repo dirtiness, branch state, and changed files before commit or push decisions.",
    defaultNextAction: "decide_next_git_step",
  },
  "git.diff": {
    coreHint:
      "Use for working-tree diff evidence before commit. Prefer this over prose when you need to show what changed.",
    defaultNextAction: "summarize_git_diff",
  },
  "git.commit": {
    coreHint:
      "Use only after the diff scope is already clear. Keep commits single-intent and path-bounded.",
    defaultNextAction: "report_commit_hash",
  },
  "git.push": {
    coreHint:
      "Use only after commit scope is confirmed. Prefer normal branch pushes and avoid force semantics.",
    defaultNextAction: "report_push_target",
  },
  "test.run": {
    coreHint:
      "Use for bounded test execution. Prefer a single focused test command and report exitCode plus key stdout/stderr facts.",
    defaultNextAction: "summarize_test_output",
  },
  "shell.session": {
    coreHint:
      "Use only for true multi-step interactive flows. Start once, then reuse the same sessionId for write, poll, and terminate.",
    defaultNextAction: "continue_same_session",
  },
  "skill.doc.generate": {
    coreHint:
      "Use for repo-local markdown or text generation when the deliverable itself is documentation. Keep it aligned to verified runtime behavior instead of speculative docs.",
    defaultNextAction: "read_back_generated_doc",
  },
  "write_todos": {
    coreHint:
      "Use for lightweight session-scoped todo state. Keep at most one item in progress and treat the result as per-session memory, not durable storage.",
    defaultNextAction: "summarize_new_and_old_todos",
  },
  "search.web": {
    coreHint:
      "Use for broad discovery when you need candidate sources, not a final sourced answer. Treat it as a search step, not as grounded completion by itself.",
    defaultNextAction: "choose_candidate_urls",
  },
  "search.fetch": {
    coreHint:
      "Use for targeted page reads after you already know the URL. Before claiming completion, inspect selectedBackend, resolvedBackend, fallbackApplied, finalUrl, transport, and page status facts.",
    defaultNextAction: "report_backend_and_page_facts",
  },
  "search.ground": {
    coreHint:
      "Use for a final web answer with source evidence when the task needs current online facts. Treat partial grounding as partial progress, not automatic completion.",
    defaultNextAction: "report_grounded_answer_with_sources",
  },
  "mcp.listTools": {
    coreHint:
      "Use to inspect the tool surface on an existing MCP connection before calling anything with side effects.",
    defaultNextAction: "select_mcp_tool",
  },
  "mcp.listResources": {
    coreHint:
      "Use to inspect the available MCP resource inventory before reading a specific URI.",
    defaultNextAction: "choose_resource_uri",
  },
  "mcp.readResource": {
    coreHint:
      "Use for read-only resource contents once you already know the target URI or have just discovered it.",
    defaultNextAction: "summarize_resource_contents",
  },
  "mp.search": {
    coreHint:
      "Use when you need governed memory retrieval across MP scopes instead of reconstructing history ad hoc inside core.",
    defaultNextAction: "report_memory_hits",
  },
  "mp.resolve": {
    coreHint:
      "Use when you need MP to return a high-signal primary and supporting memory bundle for the current task.",
    defaultNextAction: "report_memory_bundle",
  },
  "mp.history.request": {
    coreHint:
      "Use when the task explicitly needs routed history replay rather than current executable context alone.",
    defaultNextAction: "report_history_bundle",
  },
  "mp.materialize": {
    coreHint:
      "Use when checked or stored context should become durable MP memory instead of remaining only in the current turn.",
    defaultNextAction: "report_materialized_memory",
  },
  "mp.promote": {
    coreHint:
      "Use when an MP memory record should move to a broader scope under explicit lineage and promoter rules.",
    defaultNextAction: "report_promoted_memory",
  },
  "mp.archive": {
    coreHint:
      "Use when an MP memory record should be retired cleanly while preserving audit and lineage facts.",
    defaultNextAction: "report_archived_memory",
  },
  "remote.exec": {
    coreHint:
      "Use for bounded remote commands with explicit host, user, and command. Return host, exitCode, stdout, and stderr clearly.",
    defaultNextAction: "summarize_remote_result",
  },
  "tracker.create": {
    coreHint:
      "Use for creating a structured follow-up artifact inside the workspace. Return trackerId and artifact path.",
    defaultNextAction: "report_tracker_artifact",
  },
  "spreadsheet.read": {
    coreHint:
      "Use for reading csv/tsv/xlsx into structured sheet facts. Prefer headers and visible rows over vague truncation language when rows are already present.",
    defaultNextAction: "summarize_visible_rows",
  },
  "spreadsheet.write": {
    coreHint:
      "Use for bounded spreadsheet creation. After writing, read the file back with spreadsheet.read if the user asks for confirmation or visible rows.",
    defaultNextAction: "read_back_spreadsheet_if_requested",
  },
  "doc.read": {
    coreHint:
      "Use for reading docx structure and text. Prefer paragraph/table counts plus visible content summary.",
    defaultNextAction: "summarize_visible_doc_content",
  },
  "doc.write": {
    coreHint:
      "Use for bounded docx generation. After writing, read back with doc.read if the user asks for confirmation or visible content.",
    defaultNextAction: "read_back_doc_if_requested",
  },
  "browser.playwright": {
    coreHint:
      "Use for reviewed browser actions one step at a time. Treat visible page facts as stronger than external search, and keep blocked when security verification hides the target content.",
    defaultNextAction: "advance_one_browser_step",
  },
  "request_user_input": {
    coreHint:
      "Use only when safe progress depends on the operator making a real choice or filling a missing fact. Ask the smallest structured question set that can unblock the task.",
    defaultNextAction: "wait_for_user_reply",
  },
  "request_permissions": {
    coreHint:
      "Use only when the current execution envelope is genuinely too narrow. Request the smallest filesystem or network expansion that unblocks the task and explain why.",
    defaultNextAction: "wait_for_permission_decision",
  },
};

function trimLine(text: string, max = 220): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function renderExampleInput(example: CapabilityPackageUsageExample | undefined): string | undefined {
  if (!example?.input || typeof example.input !== "object") {
    return undefined;
  }
  try {
    return trimLine(JSON.stringify(example.input));
  } catch {
    return undefined;
  }
}

export function createTapCapabilityUsageIndex(input: {
  report?: TapCapabilityAvailabilityReport;
  preferredCapabilityKeys?: readonly string[];
  availableCapabilityKeys?: readonly string[];
  now?: () => Date;
} = {}): TapCapabilityUsageIndex {
  const inventory = createTapFormalFamilyInventory();
  const entryMap = new Map(
    inventory.entries.map((entry) => [entry.capabilityKey, entry] as const),
  );
  const availableSet = input.availableCapabilityKeys
    ? new Set(input.availableCapabilityKeys)
    : undefined;
  const preferred = input.preferredCapabilityKeys ?? TAP_HARDENED_CORE_INDEX_CAPABILITY_KEYS;
  const reportRowMap = new Map(
    (input.report?.rows ?? []).map((row) => [row.capabilityKey, row] as const),
  );

  const entries: TapCapabilityUsageIndexEntry[] = [];
  for (const capabilityKey of preferred) {
    if (availableSet && !availableSet.has(capabilityKey)) {
      continue;
    }
    const inventoryEntry = entryMap.get(capabilityKey);
    if (!inventoryEntry) {
      continue;
    }
    const usage = inventoryEntry.capabilityPackage.usage;
    const hint = CORE_HINTS[capabilityKey] ?? {
      coreHint: inventoryEntry.capabilityPackage.manifest.description,
    };
    const reportRow = reportRowMap.get(capabilityKey);
    entries.push({
      capabilityKey,
      familyKey: inventoryEntry.familyKey,
      riskLevel: inventoryEntry.capabilityPackage.policy.riskLevel,
      recommendedMode: inventoryEntry.capabilityPackage.policy.recommendedMode,
      usageDocRef: usage.usageDocRef,
      smokeEntry: inventoryEntry.capabilityPackage.verification.smokeEntry,
      healthEntry: inventoryEntry.capabilityPackage.verification.healthEntry,
      supportRouteCount: inventoryEntry.capabilityPackage.supportMatrix?.routes.length ?? 0,
      coreHint: hint.coreHint,
      defaultNextAction: hint.defaultNextAction,
      bestPractices: [...usage.bestPractices],
      knownLimits: [...usage.knownLimits],
      exampleInvocation: usage.exampleInvocations[0],
      availabilityStatus: reportRow?.gate.status,
    });
  }

  return {
    generatedAt: (input.now ?? (() => new Date()))().toISOString(),
    entries,
  };
}

export function renderTapCapabilityUsageIndexForCore(
  index: TapCapabilityUsageIndex,
): string {
  if (index.entries.length === 0) {
    return "";
  }
  return index.entries
    .map((entry) => {
      const exampleOperation = entry.exampleInvocation?.operation
        ? ` example:${entry.exampleInvocation.operation}`
        : "";
      const exampleInput = renderExampleInput(entry.exampleInvocation)
        ? ` input:${renderExampleInput(entry.exampleInvocation)}`
        : "";
      const exampleNotes = entry.exampleInvocation?.notes
        ? ` notes:${trimLine(entry.exampleInvocation.notes)}`
        : "";
      const nextAction = entry.defaultNextAction
        ? ` next:${entry.defaultNextAction}`
        : "";
      const bestPractice = entry.bestPractices[0]
        ? ` do:${trimLine(entry.bestPractices[0])}`
        : "";
      const knownLimit = entry.knownLimits[0]
        ? ` avoid:${trimLine(entry.knownLimits[0])}`
        : "";
      return `- ${entry.capabilityKey} [${entry.familyKey} / ${entry.riskLevel} / ${entry.recommendedMode}${entry.availabilityStatus ? ` / ${entry.availabilityStatus}` : ""}]${exampleOperation}${exampleInput}${exampleNotes}${nextAction}: ${trimLine(entry.coreHint)}${bestPractice}${knownLimit}`;
    })
    .join("\n");
}
