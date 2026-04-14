export type DisplayFamilyKey =
  | "websearch"
  | "viewing_picture"
  | "code"
  | "docs"
  | "git"
  | "shell"
  | "browser"
  | "repo"
  | "mp"
  | "mcp"
  | "skill"
  | "useract"
  | "workflow";

export type FamilyOutcomeKind =
  | "succeeded"
  | "failed"
  | "blocked"
  | "timed_out"
  | "partial";

export interface CapabilityFamilyDefinition {
  tapFamilyKey: string;
  tapFamilyTitle: string;
  familyKey: DisplayFamilyKey;
  familyTitle: string;
}

export interface CapabilityFamilyDisplayInput {
  familyKey?: string | null;
  capabilityKey?: string | null;
}

const WEBSEARCH_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "websearch",
  tapFamilyTitle: "Websearch",
  familyKey: "websearch",
  familyTitle: "WebSearch",
};

const FOUNDATION_VIEWING_PICTURE_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "viewing_picture",
  familyTitle: "ViewingPicture",
};

const FOUNDATION_CODE_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "code",
  familyTitle: "Code",
};

const FOUNDATION_DOCS_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "docs",
  familyTitle: "Docs",
};

const FOUNDATION_GIT_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "git",
  familyTitle: "Git",
};

const FOUNDATION_SHELL_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "shell",
  familyTitle: "Shell",
};

const FOUNDATION_BROWSER_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "browser",
  familyTitle: "Browser",
};

const FOUNDATION_REPO_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "repo",
  familyTitle: "Repo",
};

const MP_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "mp",
  tapFamilyTitle: "MP",
  familyKey: "mp",
  familyTitle: "MemoryPool",
};

const MCP_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "mcp",
  tapFamilyTitle: "MCP",
  familyKey: "mcp",
  familyTitle: "MCP",
};

const SKILL_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "skill",
  tapFamilyTitle: "Skill",
  familyKey: "skill",
  familyTitle: "Skill",
};

const FOUNDATION_SKILL_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "skill",
  familyTitle: "Skill",
};

const USERACT_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "userio",
  tapFamilyTitle: "UserIO",
  familyKey: "useract",
  familyTitle: "UserAct",
};

const FOUNDATION_WORKFLOW_FAMILY: CapabilityFamilyDefinition = {
  tapFamilyKey: "foundation",
  tapFamilyTitle: "Foundation",
  familyKey: "workflow",
  familyTitle: "Workflow",
};

export function resolveCapabilityFamilyDefinition(
  capabilityKey?: string | null,
): CapabilityFamilyDefinition | undefined {
  const normalized = capabilityKey?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "search.web" || normalized === "search.fetch" || normalized === "search.ground") {
    return WEBSEARCH_FAMILY;
  }
  if (
    normalized === "code.read"
    || normalized === "code.ls"
    || normalized === "code.glob"
    || normalized === "code.grep"
    || normalized === "code.read_many"
    || normalized === "code.symbol_search"
    || normalized === "code.lsp"
    || normalized === "code.edit"
    || normalized === "code.patch"
    || normalized === "code.diff"
  ) {
    return FOUNDATION_CODE_FAMILY;
  }
  if (
    normalized === "doc.read"
    || normalized === "docs.read"
    || normalized === "doc.write"
    || normalized === "spreadsheet.read"
    || normalized === "spreadsheet.write"
    || normalized === "read_pdf"
    || normalized === "read_notebook"
  ) {
    return FOUNDATION_DOCS_FAMILY;
  }
  if (normalized === "view_image") {
    return FOUNDATION_VIEWING_PICTURE_FAMILY;
  }
  if (
    normalized === "git.status"
    || normalized === "git.diff"
    || normalized === "git.commit"
    || normalized === "git.push"
  ) {
    return FOUNDATION_GIT_FAMILY;
  }
  if (
    normalized === "shell.restricted"
    || normalized === "shell.session"
    || normalized === "test.run"
    || normalized === "remote.exec"
  ) {
    return FOUNDATION_SHELL_FAMILY;
  }
  if (normalized === "browser.playwright") {
    return FOUNDATION_BROWSER_FAMILY;
  }
  if (normalized === "repo.write") {
    return FOUNDATION_REPO_FAMILY;
  }
  if (normalized.startsWith("mp.")) {
    return MP_FAMILY;
  }
  if (normalized.startsWith("mcp.")) {
    return MCP_FAMILY;
  }
  if (
    normalized === "skill.use"
    || normalized === "skill.mount"
    || normalized === "skill.prepare"
  ) {
    return SKILL_FAMILY;
  }
  if (normalized === "skill.doc.generate") {
    return FOUNDATION_SKILL_FAMILY;
  }
  if (
    normalized === "question.ask"
    || normalized === "request_user_input"
    || normalized === "request_permissions"
    || normalized === "audio.transcribe"
    || normalized === "speech.synthesize"
    || normalized === "image.generate"
  ) {
    return USERACT_FAMILY;
  }
  if (normalized === "write_todos" || normalized === "tracker.create") {
    return FOUNDATION_WORKFLOW_FAMILY;
  }
  return undefined;
}

export function resolveFamilyOutcomeKind(status?: string | null): FamilyOutcomeKind | undefined {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "success" || normalized === "completed") {
    return "succeeded";
  }
  if (normalized === "partial" || normalized === "incomplete") {
    return "partial";
  }
  if (normalized === "blocked" || normalized === "review_required" || normalized === "waiting_human" || normalized === "waiting_human_approval") {
    return "blocked";
  }
  if (normalized === "timeout" || normalized === "timed_out") {
    return "timed_out";
  }
  if (normalized === "failed" || normalized === "baseline_missing") {
    return "failed";
  }
  return undefined;
}

export function shouldRenderCapabilityFamilyBlock(
  input: CapabilityFamilyDisplayInput,
): boolean {
  const telemetryFamilyKey = typeof input.familyKey === "string" && input.familyKey.trim()
    ? input.familyKey.trim().toLowerCase()
    : null;
  if (telemetryFamilyKey) {
    return true;
  }
  return Boolean(resolveCapabilityFamilyDefinition(input.capabilityKey));
}
