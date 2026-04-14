import { readFile } from "node:fs/promises";
import path from "node:path";

export interface InitCompilerQuestion {
  id: string;
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  notePrompt?: string;
  allowAnnotation?: boolean;
}

export interface InitCompilerRepoExcerpt {
  path: string;
  content: string;
}

export interface InitCompilerReadyResult {
  kind: "ready";
  projectSummary: string;
  workingDirection: string;
  successCriteria: string[];
  repoFacts: string[];
  userPreferences: string[];
  knownConstraints: string[];
  openQuestions: string[];
  compiledSessionPreamble: string;
  completionSummary?: string;
  artifactMarkdown?: string;
}

export interface InitCompilerQuestionResult {
  kind: "questions";
  summary: string;
  questions: InitCompilerQuestion[];
}

export type InitCompilerResult =
  | InitCompilerReadyResult
  | InitCompilerQuestionResult;

const INIT_ARTIFACT_PREAMBLE_BEGIN = "<!-- PRAXIS_INIT_PREAMBLE_BEGIN -->";
const INIT_ARTIFACT_PREAMBLE_END = "<!-- PRAXIS_INIT_PREAMBLE_END -->";

function compactLine(value: string, maxChars = 160): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => compactLine(entry, 220))
      .filter((entry) => entry.length > 0)
    : [];
}

function normalizeQuestions(value: unknown): InitCompilerQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index): InitCompilerQuestion[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const prompt = typeof record.prompt === "string"
      ? compactLine(record.prompt, 220)
      : (typeof record.question === "string" ? compactLine(record.question, 220) : "");
    const options = Array.isArray(record.options)
      ? record.options.flatMap((candidate, optionIndex) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          return [];
        }
        const optionRecord = candidate as Record<string, unknown>;
        const label = typeof optionRecord.label === "string" ? compactLine(optionRecord.label, 80) : "";
        const description = typeof optionRecord.description === "string" ? compactLine(optionRecord.description, 160) : "";
        if (!label || !description) {
          return [];
        }
        return [{
          id: typeof optionRecord.id === "string" && optionRecord.id.trim().length > 0
            ? optionRecord.id
            : `option-${optionIndex + 1}`,
          label,
          description,
        }];
      })
      : [];
    if (!prompt || options.length === 0) {
      return [];
    }
    return [{
      id: typeof record.id === "string" && record.id.trim().length > 0 ? record.id : `init-question-${index + 1}`,
      prompt,
      options,
      ...(typeof record.notePrompt === "string" && record.notePrompt.trim().length > 0
        ? { notePrompt: compactLine(record.notePrompt, 160) }
        : {}),
      ...(typeof record.allowAnnotation === "boolean"
        ? { allowAnnotation: record.allowAnnotation }
        : {}),
    }];
  }).slice(0, 6);
}

function buildInitArtifactMarkdown(result: InitCompilerReadyResult, seedText: string): string {
  const sections = [
    "# Raxode Workspace AGENTS",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Seed",
    seedText.trim() || "No explicit seed text was provided.",
    "",
    "## Project Summary",
    result.projectSummary,
    "",
    "## Working Direction",
    result.workingDirection,
    "",
    "## Success Criteria",
    ...(result.successCriteria.length > 0
      ? result.successCriteria.map((entry) => `- ${entry}`)
      : ["- No explicit success criteria were compiled."]),
    "",
    "## Repo Facts",
    ...(result.repoFacts.length > 0
      ? result.repoFacts.map((entry) => `- ${entry}`)
      : ["- No repo facts were extracted."]),
    "",
    "## User Preferences",
    ...(result.userPreferences.length > 0
      ? result.userPreferences.map((entry) => `- ${entry}`)
      : ["- No explicit user preferences were compiled."]),
    "",
    "## Constraints",
    ...(result.knownConstraints.length > 0
      ? result.knownConstraints.map((entry) => `- ${entry}`)
      : ["- No explicit constraints were compiled."]),
    "",
    "## Open Questions",
    ...(result.openQuestions.length > 0
      ? result.openQuestions.map((entry) => `- ${entry}`)
      : ["- No open questions remain."]),
    "",
    INIT_ARTIFACT_PREAMBLE_BEGIN,
    result.compiledSessionPreamble.trim(),
    INIT_ARTIFACT_PREAMBLE_END,
    "",
  ];
  return `${sections.join("\n").trimEnd()}\n`;
}

function buildInitCompletionSummary(result: InitCompilerReadyResult): string {
  const lines = [
    "Raxode has completed initialization for this workspace.",
    `Main direction: ${result.workingDirection}`,
    `Project summary: ${result.projectSummary}`,
  ];
  if (result.successCriteria.length > 0) {
    lines.push(`Success criteria: ${result.successCriteria.slice(0, 2).join("；")}`);
  }
  if (result.knownConstraints.length > 0) {
    lines.push(`Constraints: ${result.knownConstraints.slice(0, 2).join("；")}`);
  }
  return lines.join("\n");
}

export function parseInitCompilerResult(raw: string): InitCompilerResult | undefined {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return undefined;
  }
  const action = typeof parsed.action === "string" ? parsed.action.trim().toLowerCase() : "";
  if (action === "ask_questions") {
    const questions = normalizeQuestions(parsed.questions);
    if (questions.length === 0) {
      return undefined;
    }
    return {
      kind: "questions",
      summary: typeof parsed.summary === "string"
        ? compactLine(parsed.summary, 240)
        : "Initialization needs a few clarifications before it can compile a stable project context.",
      questions,
    };
  }
  if (action !== "finalize") {
    return undefined;
  }
  const projectSummary = typeof parsed.projectSummary === "string" ? compactLine(parsed.projectSummary, 260) : "";
  const workingDirection = typeof parsed.workingDirection === "string" ? compactLine(parsed.workingDirection, 260) : "";
  const compiledSessionPreamble = typeof parsed.compiledSessionPreamble === "string"
    ? parsed.compiledSessionPreamble.trim()
    : "";
  if (!projectSummary || !workingDirection || !compiledSessionPreamble) {
    return undefined;
  }
  const result: InitCompilerReadyResult = {
    kind: "ready",
    projectSummary,
    workingDirection,
    successCriteria: asStringArray(parsed.successCriteria),
    repoFacts: asStringArray(parsed.repoFacts),
    userPreferences: asStringArray(parsed.userPreferences),
    knownConstraints: asStringArray(parsed.knownConstraints),
    openQuestions: asStringArray(parsed.openQuestions),
    compiledSessionPreamble,
    completionSummary: typeof parsed.completionSummary === "string" && parsed.completionSummary.trim().length > 0
      ? parsed.completionSummary.trim()
      : undefined,
  };
  result.completionSummary = result.completionSummary ?? buildInitCompletionSummary(result);
  result.artifactMarkdown = typeof parsed.artifactMarkdown === "string" && parsed.artifactMarkdown.trim().length > 0
    ? parsed.artifactMarkdown.trimEnd()
    : buildInitArtifactMarkdown(result, "");
  return result;
}

export function createFallbackInitCompilerResult(input: {
  seedText: string;
  clarifications: string[];
  repoExcerpts: InitCompilerRepoExcerpt[];
}): InitCompilerReadyResult {
  const repoFacts = input.repoExcerpts
    .slice(0, 3)
    .map((entry) => `${entry.path}: ${compactLine(entry.content, 120)}`);
  const clarificationLine = input.clarifications.length > 0
    ? `补充说明：${compactLine(input.clarifications.join("；"), 220)}`
    : "";
  const compiledSessionPreamble = [
    "Project initialization context:",
    `- Primary direction: ${compactLine(input.seedText, 180) || "Work from the current repository context and ask before assuming hidden requirements."}`,
    clarificationLine ? `- ${clarificationLine}` : "",
    ...repoFacts.slice(0, 2).map((entry) => `- Repo fact: ${entry}`),
  ].filter((line) => line.length > 0).join("\n");
  const result: InitCompilerReadyResult = {
    kind: "ready",
    projectSummary: compactLine(input.seedText, 220) || "The repository needs a reusable project initialization context.",
    workingDirection: "Start from the repository reality, keep explanations concise, and continue asking for missing high-impact facts before making hidden assumptions.",
    successCriteria: input.seedText
      ? [compactLine(input.seedText, 220)]
      : ["Compile a reusable project context that future turns can rely on."],
    repoFacts,
    userPreferences: input.clarifications.length > 0
      ? [compactLine(input.clarifications.join("；"), 220)]
      : [],
    knownConstraints: [],
    openQuestions: [],
    compiledSessionPreamble,
  };
  result.completionSummary = buildInitCompletionSummary(result);
  result.artifactMarkdown = buildInitArtifactMarkdown(result, input.seedText);
  return result;
}

export function buildInitCompilerPrompt(input: {
  seedText: string;
  clarifications: string[];
  repoExcerpts: InitCompilerRepoExcerpt[];
}): string {
  const excerptBlock = input.repoExcerpts.length > 0
    ? input.repoExcerpts.map((entry) =>
      `### ${entry.path}\n${entry.content.trim()}`).join("\n\n")
    : "No repo excerpts were available.";
  const clarificationBlock = input.clarifications.length > 0
    ? input.clarifications.map((entry, index) => `${index + 1}. ${entry}`).join("\n")
    : "None yet.";
  return [
    "You are the Raxode /init compiler.",
    "Your job is not to solve the user's business task directly. Your job is to align user intent with repository reality, ask high-impact clarification questions when needed, and then generate a reusable workspace/.raxode/AGENTS.md plus a concise session preamble.",
    "",
    "Rules:",
    "- Return JSON only. No markdown fences, no commentary.",
    "- On the first pass, strongly prefer action=ask_questions unless the seed and repo excerpts already make the goal, success criteria, output shape, and main constraints explicit enough for a stable AGENTS file.",
    "- If critical information is still missing, return action=ask_questions.",
    "- Do not ask generic onboarding questions. Every question must be justified by the current seed text or the current repository reality.",
    "- Ask at most 6 questions, and only ask things the repo excerpts cannot answer.",
    "- Each question must include 2 to 4 precise options.",
    "- Each option label must already include the compact choice header, for example 'A,Rust' or 'D,None of the above'.",
    "- Keep option descriptions short, accurate, and implementation-relevant.",
    "- When useful, set allowAnnotation=true and provide a short notePrompt.",
    "- Do not silently finalize when high-impact requirements are still implicit.",
    "- If the current seed is already enough, return action=finalize.",
    "- The compiledSessionPreamble must be concise, high-signal, and future-turn friendly.",
    "- The artifactMarkdown should be suitable for workspace/.raxode/AGENTS.md.",
    "",
    "Output schema:",
    "{",
    "  \"action\": \"ask_questions\" | \"finalize\",",
    "  \"summary\": \"... only for ask_questions\",",
    "  \"questions\": [{\"id\":\"...\",\"prompt\":\"...\",\"options\":[{\"id\":\"a\",\"label\":\"A\",\"description\":\"...\"}],\"allowAnnotation\":true,\"notePrompt\":\"...\"}],",
    "  \"projectSummary\": \"...\",",
    "  \"workingDirection\": \"...\",",
    "  \"successCriteria\": [\"...\"],",
    "  \"repoFacts\": [\"...\"],",
    "  \"userPreferences\": [\"...\"],",
    "  \"knownConstraints\": [\"...\"],",
    "  \"openQuestions\": [\"...\"],",
    "  \"compiledSessionPreamble\": \"...\",",
    "  \"completionSummary\": \"...\",",
    "  \"artifactMarkdown\": \"...\"",
    "}",
    "",
    "## User seed",
    input.seedText.trim() || "No seed text was provided.",
    "",
    "## Clarifications already collected",
    clarificationBlock,
    "",
    "## Repo excerpts",
    excerptBlock,
  ].join("\n");
}

export async function loadInitCompilerRepoExcerpts(workspaceRoot: string): Promise<InitCompilerRepoExcerpt[]> {
  const candidates = [
    "README.md",
    "memory/current-context.md",
    "AGENTS.md",
    "package.json",
    "tsconfig.json",
  ];
  const excerpts: InitCompilerRepoExcerpt[] = [];
  for (const relativePath of candidates) {
    try {
      const absolutePath = path.resolve(workspaceRoot, relativePath);
      const content = await readFile(absolutePath, "utf8");
      const trimmed = content.trim();
      if (!trimmed) {
        continue;
      }
      excerpts.push({
        path: relativePath,
        content: trimmed.slice(0, 4000),
      });
    } catch {
      continue;
    }
  }
  return excerpts;
}

export function parseInitArtifact(text: string): {
  compiledSessionPreamble?: string;
  summaryLines: string[];
} {
  const preambleMatch = text.match(
    new RegExp(`${INIT_ARTIFACT_PREAMBLE_BEGIN}\\n([\\s\\S]*?)\\n${INIT_ARTIFACT_PREAMBLE_END}`),
  );
  const compiledSessionPreamble = preambleMatch?.[1]?.trim();
  const summaryLines = text.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => line !== INIT_ARTIFACT_PREAMBLE_BEGIN && line !== INIT_ARTIFACT_PREAMBLE_END)
    .slice(0, 4);
  return {
    ...(compiledSessionPreamble ? { compiledSessionPreamble } : {}),
    summaryLines,
  };
}

export function buildInitArtifactMarkdownFromResult(result: InitCompilerReadyResult, seedText: string): string {
  return buildInitArtifactMarkdown(result, seedText);
}
