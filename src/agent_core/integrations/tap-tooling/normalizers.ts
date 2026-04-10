import type { CapabilityInvocationPlan } from "../../capability-types/index.js";
import type { TapToolingBaselineCapabilityKey } from "../../capability-package/index.js";
import {
  DEFAULT_RESTRICTED_ARG_DENY_PATTERNS,
  DEFAULT_RESTRICTED_COMMAND_DENY_PATTERNS,
  DEFAULT_TEST_COMMAND_ALLOWLIST,
  summarizeCommand,
} from "./command-runtime.js";
import {
  normalizeBrowserPlaywrightInput,
} from "./browser-playwright.js";
import { assertOperationAllowed, resolvePathWithinWorkspace } from "./paths-and-permissions.js";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  asStringRecord,
  getGrantedScope,
  normalizeNewlines,
  type NormalizedDocWriteInput,
  type NormalizedCodeEditInput,
  type NormalizedCodePatchInput,
  type NormalizedCommandInput,
  type NormalizedRepoWriteEntry,
  type NormalizedSkillDocGenerateInput,
  type NormalizedSpreadsheetWriteInput,
  type ParsedPatchHunk,
  type ParsedPatchLine,
  type ParsedPatchOperation,
  type PreparedCodeDiffState,
  type PreparedDocWriteState,
  type PreparedGitCommitState,
  type PreparedGitDiffState,
  type PreparedGitPushState,
  type PreparedGitStatusState,
  type PreparedShellSessionState,
  type PreparedSpreadsheetWriteState,
  type PreparedWriteTodosState,
  type RepoWriteEntry,
  type SpreadsheetWriteCellValue,
  type TodoEntry,
} from "./shared.js";

function tokenBudgetToMaxChars(record: Record<string, unknown>): number | undefined {
  const tokenBudget = asNumber(record.max_output_tokens);
  return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
}

export function normalizeCommandInput(params: {
  plan: CapabilityInvocationPlan;
  workspaceRoot: string;
  defaultTimeoutMs: number;
  capabilityKey: TapToolingBaselineCapabilityKey;
  operationCandidates: string[];
}): NormalizedCommandInput {
  const inputRecord = asRecord(params.plan.input) ?? {};
  const commandValue = inputRecord.command;
  const commandArray = asStringArray(commandValue);
  const command = commandArray?.[0] ?? asString(commandValue);
  if (!command) {
    throw new Error(`${params.capabilityKey} requires a non-empty command.`);
  }

  const args = commandArray
    ? [...commandArray.slice(1), ...(asStringArray(inputRecord.args) ?? [])]
    : asStringArray(inputRecord.args) ?? [];
  if (params.capabilityKey === "shell.restricted") {
    if (DEFAULT_RESTRICTED_COMMAND_DENY_PATTERNS.some((pattern) => pattern.test(command))) {
      throw new Error(`shell.restricted rejects command ${command}.`);
    }
    if (args.some((arg) => DEFAULT_RESTRICTED_ARG_DENY_PATTERNS.some((pattern) => pattern.test(arg)))) {
      throw new Error("shell.restricted rejects destructive arguments.");
    }
  }

  if (
    params.capabilityKey === "test.run"
    && !DEFAULT_TEST_COMMAND_ALLOWLIST.has(command.split(/[\\/]/u).pop() ?? command)
  ) {
    throw new Error(`test.run only allows test-oriented commands, got ${command}.`);
  }

  const scope = getGrantedScope(params.plan);
  const cwd = resolvePathWithinWorkspace({
    workspaceRoot: params.workspaceRoot,
    candidatePath:
      asString(inputRecord.cwd)
      ?? asString(inputRecord.workdir)
      ?? asString(inputRecord.dir_path)
      ?? ".",
    scope,
    operationCandidates: params.operationCandidates,
    label: `${params.capabilityKey} cwd`,
  });

  const timeoutMs =
    asNumber(inputRecord.timeoutMs)
    ?? asNumber(inputRecord.timeout_ms)
    ?? asNumber(inputRecord.timeout)
    ?? params.plan.timeoutMs
    ?? params.defaultTimeoutMs;
  const commandSummary = summarizeCommand(command, args, params.capabilityKey);
  const maxOutputChars = asNumber(inputRecord.maxOutputChars)
    ?? tokenBudgetToMaxChars(inputRecord)
    ?? (params.capabilityKey === "test.run" ? 20_000 : 12_000);

  return {
    command,
    args,
    cwd: cwd.absolutePath,
    relativeWorkspaceCwd: cwd.relativeWorkspacePath,
    timeoutMs,
    env: asStringRecord(inputRecord.env),
    runInBackground: inputRecord.runInBackground === true || inputRecord.is_background === true,
    tty: inputRecord.tty === true,
    yieldTimeMs: asNumber(inputRecord.yieldTimeMs) ?? asNumber(inputRecord.yield_time_ms),
    maxOutputChars,
    commandSummary: commandSummary.summary,
    commandKind: commandSummary.kind,
    description: asString(inputRecord.description),
  };
}

export function normalizeRepoWriteEntries(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): NormalizedRepoWriteEntry[] {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const entries = Array.isArray(record.entries)
    ? record.entries as RepoWriteEntry[]
    : [{
      path: asString(record.path) ?? "",
      content: asString(record.content),
      mode: asString(record.mode) as RepoWriteEntry["mode"] | undefined ?? "write_text",
      createParents: typeof record.createParents === "boolean" ? record.createParents : true,
    }];

  if (entries.length === 0) {
    throw new Error("repo.write requires at least one write entry.");
  }

  return entries.map((entry) => {
    const candidatePath = asString(entry.path);
    if (!candidatePath) {
      throw new Error("repo.write entry requires a non-empty path.");
    }
    const mode = entry.mode ?? "write_text";
    if (mode !== "write_text" && mode !== "append_text" && mode !== "mkdir") {
      throw new Error(`repo.write entry has unsupported mode ${String(entry.mode)}.`);
    }

    const resolved = resolvePathWithinWorkspace({
      workspaceRoot,
      candidatePath,
      scope,
      operationCandidates: [mode === "mkdir" ? "mkdir" : mode === "append_text" ? "append" : "write", "repo.write"],
      label: "repo.write path",
    });

    return {
      absolutePath: resolved.absolutePath,
      relativeWorkspacePath: resolved.relativeWorkspacePath,
      mode,
      content: entry.content,
      createParents: entry.createParents ?? true,
    };
  });
}

export function normalizeCodeEditInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): NormalizedCodeEditInput {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const candidatePath = asString(record.path) ?? asString(record.file_path) ?? asString(record.filePath);
  if (!candidatePath) {
    throw new Error("code.edit requires a non-empty path or file_path.");
  }
  const oldString = asString(record.old_string) ?? asString(record.oldString);
  const newString = asString(record.new_string) ?? asString(record.newString);
  if (oldString === undefined || newString === undefined) {
    throw new Error("code.edit requires old_string and new_string.");
  }
  if (oldString === newString) {
    throw new Error("code.edit requires old_string and new_string to differ.");
  }

  const resolved = resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath,
    scope,
    operationCandidates: ["read", "write", "mkdir", "code.edit"],
    label: "code.edit path",
  });

  return {
    absolutePath: resolved.absolutePath,
    relativeWorkspacePath: resolved.relativeWorkspacePath,
    oldString,
    newString,
    replaceAll: asBoolean(record.replace_all) ?? asBoolean(record.allow_multiple) ?? false,
    createParents: asBoolean(record.createParents) ?? true,
  };
}

export function parseCodePatchDocument(patchText: string): ParsedPatchOperation[] {
  const normalized = normalizeNewlines(patchText);
  const lines = normalized.split("\n");
  if (lines[0] !== "*** Begin Patch") {
    throw new Error("code.patch requires a Codex-style patch starting with *** Begin Patch.");
  }
  const endIndex = lines.lastIndexOf("*** End Patch");
  if (endIndex < 0) {
    throw new Error("code.patch requires a closing *** End Patch marker.");
  }

  const operations: ParsedPatchOperation[] = [];
  let index = 1;
  while (index < endIndex) {
    const line = lines[index];
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("*** Add File: ")) {
      const filePath = line.slice("*** Add File: ".length).trim();
      const addedLines: string[] = [];
      index += 1;
      while (index < endIndex && !lines[index].startsWith("*** ")) {
        const current = lines[index];
        if (!current.startsWith("+")) {
          throw new Error(`code.patch add file ${filePath} expects only + lines.`);
        }
        addedLines.push(current.slice(1));
        index += 1;
      }
      if (addedLines.length === 0) {
        throw new Error(`code.patch add file ${filePath} requires at least one + line.`);
      }
      operations.push({
        type: "add",
        path: filePath,
        lines: addedLines,
      });
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      operations.push({
        type: "delete",
        path: line.slice("*** Delete File: ".length).trim(),
      });
      index += 1;
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const filePath = line.slice("*** Update File: ".length).trim();
      let moveTo: string | undefined;
      const hunks: ParsedPatchHunk[] = [];
      index += 1;
      if (index < endIndex && lines[index].startsWith("*** Move to: ")) {
        moveTo = lines[index].slice("*** Move to: ".length).trim();
        index += 1;
      }

      while (index < endIndex && !lines[index].startsWith("*** ")) {
        const headerLine = lines[index];
        if (!headerLine.startsWith("@@")) {
          throw new Error(`code.patch update ${filePath} expects @@ hunk headers.`);
        }
        const header = headerLine.length > 2 ? headerLine.slice(2).trim() || undefined : undefined;
        index += 1;
        const hunkLines: ParsedPatchLine[] = [];
        while (index < endIndex && !lines[index].startsWith("@@") && !lines[index].startsWith("*** ")) {
          const current = lines[index];
          if (current === "*** End of File") {
            index += 1;
            break;
          }
          const prefix = current[0];
          if (prefix !== " " && prefix !== "+" && prefix !== "-") {
            throw new Error(`code.patch update ${filePath} contains invalid hunk line ${current}.`);
          }
          hunkLines.push({
            kind: prefix === " " ? "context" : prefix === "+" ? "add" : "remove",
            text: current.slice(1),
          });
          index += 1;
        }
        if (hunkLines.length === 0) {
          throw new Error(`code.patch update ${filePath} contains an empty hunk.`);
        }
        hunks.push({ header, lines: hunkLines });
      }

      if (hunks.length === 0) {
        throw new Error(`code.patch update ${filePath} requires at least one hunk.`);
      }
      operations.push({
        type: "update",
        path: filePath,
        moveTo,
        hunks,
      });
      continue;
    }

    throw new Error(`code.patch encountered an unknown directive: ${line}`);
  }

  if (operations.length === 0) {
    throw new Error("code.patch requires at least one file operation.");
  }
  return operations;
}

export function normalizeCodePatchInput(
  plan: CapabilityInvocationPlan,
): NormalizedCodePatchInput {
  const record = asRecord(plan.input) ?? {};
  const patch = asString(record.patch) ?? asString(record.diff) ?? asString(record.input);
  if (!patch) {
    throw new Error("code.patch requires a non-empty patch string.");
  }

  return {
    patch,
    operations: parseCodePatchDocument(patch),
  };
}

export function countPatchLineChanges(lines: ParsedPatchLine[]): {
  addedLines: number;
  removedLines: number;
} {
  let addedLines = 0;
  let removedLines = 0;
  for (const line of lines) {
    if (line.kind === "add") {
      addedLines += 1;
    } else if (line.kind === "remove") {
      removedLines += 1;
    }
  }
  return { addedLines, removedLines };
}

export function normalizeSkillDocSections(value: unknown): Array<{ heading: string; body: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((section, index) => {
    const record = asRecord(section);
    const heading = record ? asString(record.heading) : undefined;
    if (!heading) {
      throw new Error(`skill.doc.generate section ${index + 1} requires a heading.`);
    }

    const bodyValue = record?.body;
    if (typeof bodyValue === "string") {
      return {
        heading,
        body: bodyValue,
      };
    }

    if (Array.isArray(bodyValue) && bodyValue.every((entry) => typeof entry === "string")) {
      return {
        heading,
        body: bodyValue.join("\n"),
      };
    }

    throw new Error(`skill.doc.generate section ${index + 1} requires string body content.`);
  });
}

export function createSkillDocContent(input: {
  format: "markdown" | "text";
  title?: string;
  summary?: string;
  content?: string;
  frontmatter?: Record<string, string>;
  sections: Array<{ heading: string; body: string }>;
}): string {
  const chunks: string[] = [];
  if (input.format === "markdown" && input.frontmatter && Object.keys(input.frontmatter).length > 0) {
    const frontmatterLines = Object.entries(input.frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    chunks.push(["---", ...frontmatterLines, "---"].join("\n"));
  }

  if (input.content) {
    chunks.push(input.content);
    return chunks.join("\n\n");
  }

  if (input.title) {
    chunks.push(input.format === "markdown" ? `# ${input.title}` : input.title);
  }

  if (input.summary) {
    chunks.push(input.summary);
  }

  for (const section of input.sections) {
    if (input.format === "markdown") {
      chunks.push(`## ${section.heading}\n\n${section.body}`);
      continue;
    }

    chunks.push(`${section.heading}\n${"-".repeat(section.heading.length)}\n${section.body}`);
  }

  if (chunks.length === 0) {
    throw new Error("skill.doc.generate requires content, title, summary, or sections.");
  }

  return chunks.join("\n\n");
}

export function normalizeSkillDocGenerateInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): NormalizedSkillDocGenerateInput {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const candidatePath = asString(record.path);
  if (!candidatePath) {
    throw new Error("skill.doc.generate requires a non-empty path.");
  }

  const resolved = resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath,
    scope,
    operationCandidates: ["write", "mkdir", "skill.doc.generate"],
    label: "skill.doc.generate path",
  });
  const normalizedPath = resolved.relativeWorkspacePath.toLowerCase();
  const inferredFormat = normalizedPath.endsWith(".txt")
    ? "text"
    : normalizedPath.endsWith(".md") || normalizedPath.endsWith(".mdx")
      ? "markdown"
      : undefined;
  const requestedFormat = asString(record.format);
  const format = requestedFormat === "text" || requestedFormat === "markdown"
    ? requestedFormat
    : inferredFormat;
  if (!format) {
    throw new Error("skill.doc.generate only supports .md, .mdx, or .txt outputs.");
  }
  if (format === "markdown" && inferredFormat === "text") {
    throw new Error("skill.doc.generate markdown output requires a .md or .mdx path.");
  }
  if (format === "text" && inferredFormat !== "text") {
    throw new Error("skill.doc.generate text output requires a .txt path.");
  }

  const sections = normalizeSkillDocSections(record.sections);
  const content = createSkillDocContent({
    format,
    title: asString(record.title),
    summary: asString(record.summary),
    content: asString(record.content),
    frontmatter: asStringRecord(record.frontmatter),
    sections,
  });

  return {
    entry: {
      absolutePath: resolved.absolutePath,
      relativeWorkspacePath: resolved.relativeWorkspacePath,
      mode: "write_text",
      content,
      createParents: typeof record.createParents === "boolean" ? record.createParents : true,
    },
    format,
    title: asString(record.title),
    sectionCount: sections.length,
  };
}

function isSpreadsheetCellValue(value: unknown): value is SpreadsheetWriteCellValue {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean";
}

function normalizeSpreadsheetRows(record: Record<string, unknown>): {
  headers?: string[];
  rows: SpreadsheetWriteCellValue[][];
} {
  const rawRows = Array.isArray(record.rows) ? record.rows : undefined;
  if (!rawRows) {
    throw new Error("spreadsheet.write requires a rows array.");
  }
  const requestedHeaders = asStringArray(record.headers);
  const objectRows = rawRows.filter((entry) => asRecord(entry));
  const hasObjectRows = objectRows.length > 0;

  let headers = requestedHeaders;
  if (!headers && hasObjectRows) {
    const seen = new Set<string>();
    headers = [];
    for (const entry of rawRows) {
      const row = asRecord(entry);
      if (!row) {
        continue;
      }
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key);
          headers.push(key);
        }
      }
    }
  }

  const rows = rawRows.map((entry, index) => {
    if (Array.isArray(entry)) {
      return entry.map((cell, cellIndex) => {
        if (!isSpreadsheetCellValue(cell)) {
          throw new Error(`spreadsheet.write row ${index + 1} cell ${cellIndex + 1} must be string, number, boolean, or null.`);
        }
        return cell;
      });
    }

    const row = asRecord(entry);
    if (!row) {
      throw new Error(`spreadsheet.write row ${index + 1} must be either an array or an object.`);
    }
    if (!headers || headers.length === 0) {
      throw new Error("spreadsheet.write object rows require headers or derivable object keys.");
    }
    return headers.map((header) => {
      const value = row[header];
      if (value === undefined) {
        return null;
      }
      if (!isSpreadsheetCellValue(value)) {
        throw new Error(`spreadsheet.write row ${index + 1} field ${header} must be string, number, boolean, or null.`);
      }
      return value;
    });
  });

  return { headers, rows };
}

export function normalizeSpreadsheetWriteInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedSpreadsheetWriteState["input"] {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const candidatePath = asString(record.path);
  if (!candidatePath) {
    throw new Error("spreadsheet.write requires a non-empty path.");
  }
  const resolved = resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath,
    scope,
    operationCandidates: ["write", "mkdir", "spreadsheet.write"],
    label: "spreadsheet.write path",
  });
  const normalizedPath = resolved.relativeWorkspacePath.toLowerCase();
  const format = normalizedPath.endsWith(".csv")
    ? "csv"
    : normalizedPath.endsWith(".tsv")
      ? "tsv"
      : normalizedPath.endsWith(".xlsx")
        ? "xlsx"
        : undefined;
  if (!format) {
    throw new Error("spreadsheet.write currently supports only .csv, .tsv, or .xlsx outputs.");
  }
  if (asString(record.sheet)) {
    throw new Error("spreadsheet.write first version does not yet support writing a named sheet.");
  }

  const { headers, rows } = normalizeSpreadsheetRows(record);
  const columnCount = Math.max(
    headers?.length ?? 0,
    ...rows.map((row) => row.length),
  );

  return {
    absolutePath: resolved.absolutePath,
    relativeWorkspacePath: resolved.relativeWorkspacePath,
    format,
    headers,
    rows,
    rowCount: rows.length,
    columnCount,
    createParents: asBoolean(record.createParents) ?? true,
  };
}

function createDocWriteText(record: Record<string, unknown>): {
  textContent: string;
  title?: string;
  sectionCount: number;
} {
  const title = asString(record.title);
  const summary = asString(record.summary);
  const content = asString(record.content);
  const format = asString(record.format);
  if (format && format !== "text" && format !== "markdown") {
    throw new Error("doc.write format currently supports only text or markdown.");
  }

  const sectionsValue = Array.isArray(record.sections) ? record.sections : [];
  const sections = sectionsValue.map((entry, index) => {
    const section = asRecord(entry);
    const heading = section ? asString(section.heading) : undefined;
    const bodyValue = section?.body;
    const body = typeof bodyValue === "string"
      ? bodyValue
      : Array.isArray(bodyValue)
        ? bodyValue.filter((item): item is string => typeof item === "string").join("\n")
        : undefined;
    if (!heading || !body) {
      throw new Error(`doc.write section ${index + 1} requires heading and body.`);
    }
    return { heading, body };
  });

  if (!title && !summary && !content && sections.length === 0) {
    throw new Error("doc.write requires title, summary, content, or sections.");
  }

  const parts: string[] = [];
  if (title) {
    parts.push(title);
  }
  if (summary) {
    parts.push(summary);
  }
  if (content) {
    parts.push(content);
  }
  for (const section of sections) {
    parts.push(`${section.heading}\n${section.body}`);
  }

  return {
    textContent: parts.join("\n\n").trim(),
    title,
    sectionCount: sections.length,
  };
}

export function normalizeDocWriteInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedDocWriteState["input"] {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const candidatePath = asString(record.path);
  if (!candidatePath) {
    throw new Error("doc.write requires a non-empty path.");
  }
  const resolved = resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath,
    scope,
    operationCandidates: ["write", "mkdir", "doc.write"],
    label: "doc.write path",
  });
  if (!resolved.relativeWorkspacePath.toLowerCase().endsWith(".docx")) {
    throw new Error("doc.write first version currently supports only .docx outputs.");
  }

  const rendered = createDocWriteText(record);
  return {
    absolutePath: resolved.absolutePath,
    relativeWorkspacePath: resolved.relativeWorkspacePath,
    format: "docx",
    textContent: rendered.textContent,
    title: rendered.title,
    sectionCount: rendered.sectionCount,
    createParents: asBoolean(record.createParents) ?? true,
  };
}

export function normalizeShellSessionAction(value: unknown): "start" | "poll" | "write" | "terminate" {
  return value === "poll" || value === "write" || value === "terminate" ? value : "start";
}

export function normalizeShellSessionInput(params: {
  plan: CapabilityInvocationPlan;
  workspaceRoot: string;
  defaultTimeoutMs: number;
}): PreparedShellSessionState["input"] {
  const record = asRecord(params.plan.input) ?? {};
  const action = normalizeShellSessionAction(record.action);
  const sessionId = asString(record.sessionId) ?? asString(record.session_id);
  const chars = asString(record.chars) ?? "";
  if (action === "poll" || action === "write" || action === "terminate") {
    if (!sessionId) {
      throw new Error(`shell.session action ${action} requires sessionId.`);
    }
    return {
      action,
      sessionId,
      chars,
      command: "",
      args: [],
      cwd: params.workspaceRoot,
      relativeWorkspaceCwd: ".",
      timeoutMs:
        asNumber(record.timeoutMs)
        ?? asNumber(record.timeout_ms)
        ?? asNumber(record.timeout)
        ?? params.plan.timeoutMs
        ?? params.defaultTimeoutMs,
      env: asStringRecord(record.env),
      runInBackground: false,
      tty: record.tty === true,
      yieldTimeMs: asNumber(record.yieldTimeMs) ?? asNumber(record.yield_time_ms) ?? 250,
      maxOutputChars:
        asNumber(record.maxOutputChars)
        ?? tokenBudgetToMaxChars(record)
        ?? 12_000,
      commandSummary: `session:${action}`,
      commandKind: "general",
      description: asString(record.description),
    };
  }

  return {
    action,
    ...normalizeCommandInput({
      plan: params.plan,
      workspaceRoot: params.workspaceRoot,
      defaultTimeoutMs: params.defaultTimeoutMs,
      capabilityKey: "shell.session" as TapToolingBaselineCapabilityKey,
      operationCandidates: ["exec", "shell.session"],
    }),
    sessionId,
    chars,
  };
}

export function normalizeGitCwd(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
  operationCandidates: string[],
  label: string,
) {
  const record = asRecord(plan.input) ?? {};
  return resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath:
      asString(record.cwd)
      ?? asString(record.workdir)
      ?? asString(record.dir_path)
      ?? ".",
    scope: getGrantedScope(plan),
    operationCandidates,
    label,
  });
}

export function normalizeGitStatusInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitStatusState {
  const record = asRecord(plan.input) ?? {};
  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "git.status"], "git.status cwd"),
    includeIgnored: asBoolean(record.includeIgnored) ?? asBoolean(record.include_ignored) ?? false,
    maxEntries: asNumber(record.maxEntries) ?? 200,
    maxOutputChars: asNumber(record.maxOutputChars) ?? tokenBudgetToMaxChars(record) ?? 10_000,
  };
}

export function normalizeGitDiffInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitDiffState {
  const record = asRecord(plan.input) ?? {};
  const scope = getGrantedScope(plan);
  const rawPaths = asStringArray(record.paths) ?? (asString(record.path) ? [asString(record.path)!] : undefined);
  const paths = rawPaths?.map((candidatePath) =>
    resolvePathWithinWorkspace({
      workspaceRoot,
      candidatePath,
      scope,
      operationCandidates: ["read", "git.diff"],
      label: "git.diff path",
    }).relativeWorkspacePath
  );
  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "git.diff"], "git.diff cwd"),
    paths,
    staged: asBoolean(record.staged) ?? asBoolean(record.cached) ?? false,
    base: asString(record.base) ?? asString(record.rev),
    maxOutputChars: asNumber(record.maxOutputChars) ?? tokenBudgetToMaxChars(record) ?? 16_000,
  };
}

export const SECRET_LIKE_GIT_PATH_PATTERNS = [
  /(^|\/)\.env(\.|$|\/)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /(^|\/)credentials(\.[^.\/]+)?\.json$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.pem$/i,
  /\.key$/i,
];

export function normalizeGitCommitInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitCommitState {
  const record = asRecord(plan.input) ?? {};
  if (asBoolean(record.amend) === true) {
    throw new Error("git.commit does not allow amend; create a new commit instead.");
  }
  if ((asBoolean(record.noVerify) ?? asBoolean(record.no_verify)) === true) {
    throw new Error("git.commit does not allow skipping hooks or verification.");
  }

  const scope = getGrantedScope(plan);
  const rawPaths = asStringArray(record.paths) ?? (asString(record.path) ? [asString(record.path)!] : undefined);
  const stageAll = asBoolean(record.all) === true;
  if (!stageAll && (!rawPaths || rawPaths.length === 0)) {
    throw new Error("git.commit requires explicit path(s) unless all=true is provided.");
  }

  const paths = rawPaths?.map((candidatePath) =>
    resolvePathWithinWorkspace({
      workspaceRoot,
      candidatePath,
      scope,
      operationCandidates: ["read", "write", "exec", "git.commit"],
      label: "git.commit path",
    }).relativeWorkspacePath
  );

  for (const candidate of paths ?? []) {
    if (SECRET_LIKE_GIT_PATH_PATTERNS.some((pattern) => pattern.test(candidate))) {
      throw new Error(`git.commit blocks secret-like path ${candidate}.`);
    }
  }

  const message = asString(record.message) ?? asString(record.commitMessage);
  if (!message || message.trim().length === 0) {
    throw new Error("git.commit requires a non-empty commit message.");
  }

  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "write", "exec", "git.commit"], "git.commit cwd"),
    paths,
    stageAll,
    message: message.trim(),
    authorName: asString(record.authorName) ?? asString(record.author_name),
    authorEmail: asString(record.authorEmail) ?? asString(record.author_email),
    maxOutputChars: asNumber(record.maxOutputChars) ?? tokenBudgetToMaxChars(record) ?? 10_000,
  };
}

export function normalizeGitPushInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitPushState {
  const record = asRecord(plan.input) ?? {};
  if (asBoolean(record.force) === true || (asBoolean(record.forceWithLease) ?? asBoolean(record.force_with_lease)) === true) {
    throw new Error("git.push does not allow force push or force-with-lease.");
  }

  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "write", "exec", "git.push"], "git.push cwd"),
    remote: asString(record.remote)?.trim() || "origin",
    branch: asString(record.branch)?.trim() || undefined,
    setUpstream: asBoolean(record.setUpstream) ?? asBoolean(record.set_upstream) ?? false,
    maxOutputChars: asNumber(record.maxOutputChars) ?? tokenBudgetToMaxChars(record) ?? 10_000,
  };
}

export function normalizeCodeDiffInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedCodeDiffState {
  const record = asRecord(plan.input) ?? {};
  const leftPath = asString(record.leftPath) ?? asString(record.path);
  const rightPath = asString(record.rightPath);
  const before = asString(record.before);
  const after = asString(record.after);
  const base = asString(record.base);
  if (!before && !leftPath) {
    throw new Error("code.diff requires leftPath/path or before.");
  }
  if (!after && !rightPath && !base) {
    throw new Error("code.diff requires rightPath/after or base.");
  }
  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "code.diff"], "code.diff cwd"),
    leftPath,
    rightPath,
    before,
    after,
    base,
    scope: getGrantedScope(plan),
    maxOutputChars: asNumber(record.maxOutputChars) ?? tokenBudgetToMaxChars(record) ?? 16_000,
  };
}

export function normalizeWriteTodosInput(
  plan: CapabilityInvocationPlan,
): PreparedWriteTodosState {
  const record = asRecord(plan.input) ?? {};
  const todosValue = record.todos;
  if (!Array.isArray(todosValue)) {
    throw new Error("write_todos requires a todos array.");
  }

  const todos = todosValue.map((todo, index) => {
    const entry = asRecord(todo);
    const description = entry ? asString(entry.description) : undefined;
    const status = entry ? asString(entry.status) : undefined;
    if (!description) {
      throw new Error(`write_todos item ${index + 1} requires a non-empty description.`);
    }
    if (
      status !== "pending"
      && status !== "in_progress"
      && status !== "completed"
      && status !== "cancelled"
      && status !== "blocked"
    ) {
      throw new Error(`write_todos item ${index + 1} has unsupported status ${String(status)}.`);
    }
    return { description, status };
  });

  if (todos.filter((todo) => todo.status === "in_progress").length > 1) {
    throw new Error("write_todos allows at most one in_progress item.");
  }

  return {
    sessionId: plan.sessionId,
    todos: todos as TodoEntry[],
  };
}

export { assertOperationAllowed, normalizeBrowserPlaywrightInput };
