import type {
  CapabilityManifest,
  CapabilityRouteHint,
} from "../capability-types/index.js";
import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  type CapabilityPackage,
} from "./capability-package.js";

export const FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS = [
  "code.read",
  "code.ls",
  "code.glob",
  "code.grep",
  "code.read_many",
  "code.symbol_search",
  "code.lsp",
  "spreadsheet.read",
  "doc.read",
  "read_pdf",
  "read_notebook",
  "view_image",
  "docs.read",
] as const;
export type FirstClassToolingBaselineCapabilityKey =
  (typeof FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS)[number];

export const FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS = [
  "read_file",
  "read_lines",
  "list_dir",
  "stat_path",
  "glob",
  "grep",
  "read_many",
  "workspace_symbol",
  "document_symbol",
  "definition",
  "references",
  "hover",
  "read_spreadsheet",
  "read_document",
  "read_pdf",
  "read_notebook",
  "view_image",
] as const;
export type FirstClassToolingAllowedOperation =
  (typeof FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS)[number];

export interface FirstClassToolingCapabilityBaselineDescriptor {
  capabilityKey: FirstClassToolingBaselineCapabilityKey;
  scopeKind: "workspace-code" | "workspace-docs";
  scopeSummary: string;
  description: string;
  reviewerSummary: string;
  pathPatterns: string[];
  allowedOperations: FirstClassToolingAllowedOperation[];
  usageDocRef: string;
  examplePath: string;
  exampleOperation: FirstClassToolingAllowedOperation;
  routeHints: CapabilityRouteHint[];
  tags: string[];
  knownLimits: string[];
  workerConsumers: string[];
}

const FIRST_CLASS_TOOLING_BASELINE_DESCRIPTORS: Record<
  FirstClassToolingBaselineCapabilityKey,
  FirstClassToolingCapabilityBaselineDescriptor
> = {
  "code.read": {
    capabilityKey: "code.read",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source, config, and build-support files that a reviewer or planner may inspect safely.",
    description:
      "Read repo-local source and build files for TAP reviewer or TMA planning without introducing write side effects.",
    reviewerSummary:
      "Reviewer can inspect source and build context inside the repo, but cannot patch files or execute tasks through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "scripts",
      "scripts/**",
    ],
    allowedOperations: [...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src/agent_core/runtime.ts",
    exampleOperation: "read_lines",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
    ],
    tags: ["tap", "baseline", "read", "code", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it never writes or patches files.",
      "Scope stays inside repo-local code and build files only.",
      "Binary or oversized files may be truncated for safe context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "code.ls": {
    capabilityKey: "code.ls",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source trees and build-support directories that core can list safely for structure discovery.",
    description:
      "List repo-local code and build directories without mutating the workspace.",
    reviewerSummary:
      "Core or reviewer can inspect directory structure inside the repo, but cannot read file bodies or write changes through this capability alone.",
    pathPatterns: [
      "src",
      "src/**",
      "scripts",
      "scripts/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    allowedOperations: ["list_dir", "stat_path"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src",
    exampleOperation: "list_dir",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "directory-discovery" },
    ],
    tags: ["tap", "baseline", "read", "code", "list", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it never reads full file bodies.",
      "Large directories may be truncated to a bounded entry count.",
      "Scope stays inside repo-local code and build directories only.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "code.glob": {
    capabilityKey: "code.glob",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source and build files that can be discovered by glob pattern for planning or targeted follow-up reads.",
    description:
      "Find repo-local code and build files by glob pattern inside the allowed workspace scope.",
    reviewerSummary:
      "Core or reviewer can discover candidate files by glob pattern, but cannot read or write file bodies through this capability alone.",
    pathPatterns: [
      "src",
      "src/**",
      "scripts",
      "scripts/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    allowedOperations: ["glob"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src/**/*.ts",
    exampleOperation: "glob",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "glob-search" },
    ],
    tags: ["tap", "baseline", "read", "code", "glob", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it returns path matches only.",
      "Pattern matching stays inside the configured workspace scope.",
      "Result sets may be truncated for bounded context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "code.grep": {
    capabilityKey: "code.grep",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source and build files that can be searched by content pattern for codebase investigation.",
    description:
      "Search repo-local code and build files by textual or regex-like pattern inside the allowed workspace scope.",
    reviewerSummary:
      "Core or reviewer can search code content for symbols, strings, or patterns, but cannot mutate files through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "scripts",
      "scripts/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    allowedOperations: ["grep"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src",
    exampleOperation: "grep",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "content-search" },
    ],
    tags: ["tap", "baseline", "read", "code", "grep", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it returns bounded search hits rather than full project dumps.",
      "Binary files and oversized files may be skipped.",
      "Result sets may be truncated for bounded context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "code.read_many": {
    capabilityKey: "code.read_many",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source and build files that can be batch-read by explicit paths or glob patterns for higher-signal codebase context.",
    description:
      "Batch-read multiple repo-local code or build files inside the allowed workspace scope.",
    reviewerSummary:
      "Core or reviewer can collect bounded multi-file context, but still cannot write or patch files through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "scripts",
      "scripts/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    allowedOperations: ["read_many"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src/**/*.ts",
    exampleOperation: "read_many",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "batch-read" },
    ],
    tags: ["tap", "baseline", "read", "code", "batch", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; each file body is still bounded.",
      "Result sets may be truncated by file count or byte budget.",
      "Binary files and unsupported assets may be skipped.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "code.symbol_search": {
    capabilityKey: "code.symbol_search",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source trees that can be searched by symbol name using code-intelligence-first semantics, with text fallback when language services are unavailable.",
    description:
      "Search repo-local code symbols across the workspace using TypeScript-aware navigation first, then bounded textual fallback when needed.",
    reviewerSummary:
      "Core or reviewer can search for symbol definitions and likely declaration points, but cannot mutate files through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "scripts",
      "scripts/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    allowedOperations: ["workspace_symbol"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src",
    exampleOperation: "workspace_symbol",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "symbol-search" },
    ],
    tags: ["tap", "baseline", "read", "code", "symbol", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it returns bounded symbol matches only.",
      "Semantic symbol search is strongest for TypeScript and JavaScript workspaces.",
      "When language-service data is unavailable, results may degrade to textual fallback matches.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "code.lsp": {
    capabilityKey: "code.lsp",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local source files that can be inspected with language-intelligence style queries such as document symbols, definitions, references, and hover.",
    description:
      "Run bounded language-intelligence queries against repo-local code using TypeScript-aware semantics where available.",
    reviewerSummary:
      "Core or reviewer can inspect symbol structure and jump-like metadata, but cannot change files or execute code through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "scripts",
      "scripts/**",
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    allowedOperations: [
      "workspace_symbol",
      "document_symbol",
      "definition",
      "references",
      "hover",
    ],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "src/agent_core/runtime.ts",
    exampleOperation: "document_symbol",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "language-intelligence" },
    ],
    tags: ["tap", "baseline", "read", "code", "lsp", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it only returns bounded semantic metadata.",
      "Current implementation is strongest on TypeScript and JavaScript source files.",
      "Cross-language project-wide LSP coverage may still require future provider-specific backends.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "spreadsheet.read": {
    capabilityKey: "spreadsheet.read",
    scopeKind: "workspace-docs",
    scopeSummary:
      "Repo-local spreadsheet and tabular data files that core can inspect safely without mutating formulas or workbook state.",
    description:
      "Read repo-local CSV, TSV, and XLSX files as bounded structured tables instead of raw binary blobs.",
    reviewerSummary:
      "Core or reviewer can inspect spreadsheet structure and sample rows, but cannot modify workbook contents through this capability.",
    pathPatterns: [
      "data",
      "data/**",
      "docs",
      "docs/**",
      "output",
      "output/**",
      "*.csv",
      "**/*.csv",
      "*.tsv",
      "**/*.tsv",
      "*.xlsx",
      "**/*.xlsx",
    ],
    allowedOperations: ["read_spreadsheet"],
    usageDocRef: "docs/ability/25-tap-capability-package-template.md",
    examplePath: "data/report.xlsx",
    exampleOperation: "read_spreadsheet",
    routeHints: [
      { key: "scope", value: "workspace-docs" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "spreadsheet-read" },
    ],
    tags: ["tap", "baseline", "read", "spreadsheet", "data", "reviewer", "tma"],
    knownLimits: [
      "Reads table structure and bounded sample rows; it does not preserve workbook formatting.",
      "Formula cells return cached values or textual formulas rather than recalculating the workbook.",
      "Large sheets are truncated by row count and byte budget for safe context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "doc.read": {
    capabilityKey: "doc.read",
    scopeKind: "workspace-docs",
    scopeSummary:
      "Repo-local office documents that core can inspect safely through bounded structured extraction instead of raw OOXML or binary blobs.",
    description:
      "Read repo-local DOCX documents as bounded paragraphs and tables for planner, reviewer, and TMA consumption.",
    reviewerSummary:
      "Core or reviewer can inspect word-processing document structure and text content, but cannot modify the document through this capability.",
    pathPatterns: [
      "docs",
      "docs/**",
      "output",
      "output/**",
      "*.docx",
      "**/*.docx",
    ],
    allowedOperations: ["read_document"],
    usageDocRef: "docs/ability/25-tap-capability-package-template.md",
    examplePath: "docs/spec.docx",
    exampleOperation: "read_document",
    routeHints: [
      { key: "scope", value: "workspace-docs" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "document-read" },
    ],
    tags: ["tap", "baseline", "read", "docx", "document", "docs", "reviewer", "tma"],
    knownLimits: [
      "Current implementation focuses on DOCX OOXML text and table extraction rather than preserving Word formatting.",
      "Headers, footers, comments, and tracked changes are not fully surfaced in the first version.",
      "Large documents are truncated by byte budget and bounded table samples for stable context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "read_pdf": {
    capabilityKey: "read_pdf",
    scopeKind: "workspace-docs",
    scopeSummary:
      "Repo-local PDF documents that can be read through bounded text extraction with page-aware semantics.",
    description:
      "Read repo-local PDF documents through bounded extracted text instead of raw binary dumps.",
    reviewerSummary:
      "Core or reviewer can inspect PDF content and page metadata, but cannot edit the file or execute document-side effects through this capability.",
    pathPatterns: [
      "docs",
      "docs/**",
      "*.pdf",
      "**/*.pdf",
      "memory",
      "memory/**",
    ],
    allowedOperations: ["read_pdf"],
    usageDocRef:
      "docs/ability/tap-runtime-completion-task-pack/11-first-class-tooling-baseline-for-reviewer-and-tma.md",
    examplePath: "docs/spec.pdf",
    exampleOperation: "read_pdf",
    routeHints: [
      { key: "scope", value: "workspace-docs" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "pdf-read" },
    ],
    tags: ["tap", "baseline", "read", "pdf", "docs", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it returns extracted text and metadata rather than raw PDF bytes.",
      "Extraction quality depends on the PDF containing selectable text.",
      "Large PDFs are bounded by page ranges and byte budgets to keep context transfer stable.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "read_notebook": {
    capabilityKey: "read_notebook",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local Jupyter notebooks that can be read as bounded structured cells instead of raw JSON blobs.",
    description:
      "Read repo-local notebooks with cell-aware structure, bounded outputs, and lightweight execution metadata.",
    reviewerSummary:
      "Core or reviewer can inspect notebook cells and selected outputs, but cannot execute or edit notebook cells through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "*.ipynb",
      "**/*.ipynb",
      "notebooks",
      "notebooks/**",
      "docs",
      "docs/**",
    ],
    allowedOperations: ["read_notebook"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "notebooks/demo.ipynb",
    exampleOperation: "read_notebook",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "notebook-read" },
    ],
    tags: ["tap", "baseline", "read", "notebook", "code", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it returns bounded cell structure instead of the full raw notebook JSON.",
      "Large notebook outputs are summarized rather than fully expanded.",
      "Notebook binary attachments are not inlined as full multimodal payloads here.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "view_image": {
    capabilityKey: "view_image",
    scopeKind: "workspace-code",
    scopeSummary:
      "Repo-local image assets and screenshots that can be attached into multimodal model context through a bounded local-image bridge.",
    description:
      "Read a repo-local image file and expose it as a bounded local-image input for multimodal model passes.",
    reviewerSummary:
      "Core or reviewer can inspect repo-local images through a local-image bridge, but cannot edit the image or write files through this capability.",
    pathPatterns: [
      "src",
      "src/**",
      "docs",
      "docs/**",
      "assets",
      "assets/**",
      "*.png",
      "*.jpg",
      "*.jpeg",
      "*.webp",
      "*.gif",
      "**/*.png",
      "**/*.jpg",
      "**/*.jpeg",
      "**/*.webp",
      "**/*.gif",
    ],
    allowedOperations: ["view_image"],
    usageDocRef: "docs/ability/01-basic-implementation.md",
    examplePath: "assets/mockup.png",
    exampleOperation: "view_image",
    routeHints: [
      { key: "scope", value: "workspace-code" },
      { key: "baseline", value: "reviewer-tma" },
      { key: "toolKind", value: "local-image-view" },
    ],
    tags: ["tap", "baseline", "read", "image", "multimodal", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it attaches supported local raster images only.",
      "Current implementation is intended for model-visible local images, not arbitrary binary assets.",
      "Unsupported MIME types are rejected rather than being coerced into fake image inputs.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
  "docs.read": {
    capabilityKey: "docs.read",
    scopeKind: "workspace-docs",
    scopeSummary:
      "Repo-local docs, markdown guidance, and project memory artifacts that ground reviewer decisions.",
    description:
      "Read repo-local docs, markdown guidance, and project memory artifacts for TAP reviewer or TMA planning.",
    reviewerSummary:
      "Reviewer can inspect docs and memory context inside the repo, but cannot edit docs or change project memory through this capability.",
    pathPatterns: [
      "docs",
      "docs/**",
      "README.md",
      "AGENTS.md",
      "*.md",
      "memory",
      "memory/**",
    ],
    allowedOperations: [...FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS],
    usageDocRef:
      "docs/ability/tap-runtime-completion-task-pack/11-first-class-tooling-baseline-for-reviewer-and-tma.md",
    examplePath: "docs/ability/25-tap-capability-package-template.md",
    exampleOperation: "read_file",
    routeHints: [
      { key: "scope", value: "workspace-docs" },
      { key: "baseline", value: "reviewer-tma" },
    ],
    tags: ["tap", "baseline", "read", "docs", "reviewer", "tma"],
    knownLimits: [
      "Read-only capability; it cannot edit docs or memory files.",
      "Scope stays inside repo-local documentation and markdown guidance.",
      "Binary or oversized files may be truncated for safe context transfer.",
    ],
    workerConsumers: ["reviewer", "bootstrap_tma", "extended_tma"],
  },
};

export function getFirstClassToolingCapabilityBaselineDescriptor(
  capabilityKey: FirstClassToolingBaselineCapabilityKey,
): FirstClassToolingCapabilityBaselineDescriptor {
  const descriptor = FIRST_CLASS_TOOLING_BASELINE_DESCRIPTORS[capabilityKey];
  return {
    ...descriptor,
    pathPatterns: [...descriptor.pathPatterns],
    allowedOperations: [...descriptor.allowedOperations],
    routeHints: descriptor.routeHints.map((entry) => ({ ...entry })),
    tags: [...descriptor.tags],
    knownLimits: [...descriptor.knownLimits],
    workerConsumers: [...descriptor.workerConsumers],
  };
}

function createFirstClassToolingActivationSpec(
  descriptor: FirstClassToolingCapabilityBaselineDescriptor,
) {
  return {
    targetPool: "ta-capability-pool" as const,
    activationMode: "activate_immediately" as const,
    registerOrReplace: "register_or_replace" as const,
    generationStrategy: "reuse_current_generation" as const,
    drainStrategy: "graceful" as const,
    manifestPayload: {
      capabilityKey: descriptor.capabilityKey,
      kind: "tool",
      version: "1.0.0",
      generation: 1,
      description: descriptor.description,
      routeHints: descriptor.routeHints,
      tags: descriptor.tags,
      supportsPrepare: true,
    },
    bindingPayload: {
      capabilityKey: descriptor.capabilityKey,
      adapterId: `adapter:${descriptor.capabilityKey}`,
      runtimeKind: "workspace-read",
      allowedOperations: [...descriptor.allowedOperations],
      allowedPathPatterns: descriptor.pathPatterns,
    },
    adapterFactoryRef: `factory:${descriptor.capabilityKey}`,
  };
}

function createFirstClassToolingCapabilityPackage(
  capabilityKey: FirstClassToolingBaselineCapabilityKey,
): CapabilityPackage {
  const descriptor =
    getFirstClassToolingCapabilityBaselineDescriptor(capabilityKey);
  const activationSpec = createFirstClassToolingActivationSpec(descriptor);

  return createCapabilityPackage({
    manifest: {
      capabilityKey: descriptor.capabilityKey,
      capabilityKind: "tool",
      tier: "B0",
      version: "1.0.0",
      generation: 1,
      description: descriptor.description,
      dependencies: [],
      tags: descriptor.tags,
      routeHints: descriptor.routeHints,
      supportedPlatforms: ["linux", "macos", "windows"],
      metadata: {
        baseline: "first-class-tooling",
        baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
        scopeKind: descriptor.scopeKind,
        scopeSummary: descriptor.scopeSummary,
        reviewerSummary: descriptor.reviewerSummary,
        allowedOperations: [...descriptor.allowedOperations],
        pathPatterns: [...descriptor.pathPatterns],
        workerConsumers: [...descriptor.workerConsumers],
      },
    },
    adapter: {
      adapterId: `adapter:${descriptor.capabilityKey}`,
      runtimeKind: "workspace-read",
      supports: [...descriptor.allowedOperations],
      prepare: {
        ref: `adapter.prepare:${descriptor.capabilityKey}`,
        description:
          "Normalize read-only workspace access within the allowed baseline scope.",
      },
      execute: {
        ref: `adapter.execute:${descriptor.capabilityKey}`,
        description:
          "Read files or directories without mutating the workspace.",
      },
      resultMapping: {
        successStatuses: ["success", "partial"],
        artifactKinds: ["usage"],
      },
      metadata: {
        readOnly: true,
        scopeKind: descriptor.scopeKind,
        allowedOperations: [...descriptor.allowedOperations],
        pathPatterns: [...descriptor.pathPatterns],
      },
    },
    policy: {
      defaultBaseline: {
        grantedTier: "B0",
        mode: "standard",
        scope: {
          pathPatterns: descriptor.pathPatterns,
          allowedOperations: [...descriptor.allowedOperations],
        },
        metadata: {
          baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
          reviewerSummary: descriptor.reviewerSummary,
        },
      },
      recommendedMode: "standard",
      riskLevel: "normal",
      defaultScope: {
        pathPatterns: descriptor.pathPatterns,
        allowedOperations: [...descriptor.allowedOperations],
      },
      reviewRequirements: ["allow"],
      safetyFlags: ["read_only", "workspace_scoped"],
      humanGateRequirements: [],
      metadata: {
        reviewerReadable: true,
        scopeKind: descriptor.scopeKind,
        scopeSummary: descriptor.scopeSummary,
      },
    },
    builder: {
      builderId: `builder:${descriptor.capabilityKey}`,
      buildStrategy: "builtin-runtime-baseline",
      requiresNetwork: false,
      requiresInstall: false,
      requiresSystemWrite: false,
      allowedWorkdirScope: descriptor.pathPatterns,
      activationSpecRef:
        createCapabilityPackageActivationSpecRef(activationSpec),
      replayCapability: "none",
      metadata: {
        readOnly: true,
        baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
      },
    },
    verification: {
      smokeEntry: `smoke:${descriptor.capabilityKey}`,
      healthEntry: `health:${descriptor.capabilityKey}`,
      successCriteria: [
        "Allowed file reads return stable content.",
        "Directory listings stay inside the declared scope.",
      ],
      failureSignals: [
        "Requested path escapes the workspace root.",
        "Requested path does not match the declared baseline scope.",
      ],
      evidenceOutput: ["read-summary", "path-scope-check"],
      metadata: {
        baselineDescriptorRef: `first-class-tooling:${descriptor.capabilityKey}`,
        scopeSummary: descriptor.scopeSummary,
      },
    },
    usage: {
      usageDocRef: descriptor.usageDocRef,
      bestPractices: [
        "Use read_lines for focused snippets and read_file for full docs.",
        "Prefer docs.read for docs or markdown, and code.read for source or build files.",
      ],
      knownLimits: descriptor.knownLimits,
      exampleInvocations: [
        {
          exampleId: `${descriptor.capabilityKey}:example`,
          capabilityKey: descriptor.capabilityKey,
          operation: descriptor.exampleOperation,
          input: {
            path: descriptor.examplePath,
            ...(descriptor.exampleOperation === "read_lines"
              ? { lineStart: 1, lineEnd: 80 }
              : {}),
          },
        },
      ],
      metadata: {
        reviewerSummary: descriptor.reviewerSummary,
        scopeSummary: descriptor.scopeSummary,
      },
    },
    lifecycle: {
      installStrategy: "register built-in adapter at runtime startup",
      replaceStrategy:
        "register_or_replace the same capability key when the baseline evolves",
      rollbackStrategy:
        "restore the previous binding generation if a replacement regresses",
      deprecateStrategy: "remove from baseline helpers before unregistering",
      cleanupStrategy:
        "clear transient prepared-read state after dispatch completes",
      generationPolicy: "reuse_current_generation",
    },
    activationSpec,
    replayPolicy: "none",
    metadata: {
      baseline: "first-class-tooling",
    },
  });
}

export function createCodeReadCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.read");
}

export function createCodeLsCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.ls");
}

export function createCodeGlobCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.glob");
}

export function createCodeGrepCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.grep");
}

export function createCodeReadManyCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.read_many");
}

export function createCodeSymbolSearchCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.symbol_search");
}

export function createCodeLspCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("code.lsp");
}

export function createSpreadsheetReadCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("spreadsheet.read");
}

export function createDocReadCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("doc.read");
}

export function createReadPdfCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("read_pdf");
}

export function createReadNotebookCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("read_notebook");
}

export function createViewImageCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("view_image");
}

export function createDocsReadCapabilityPackage(): CapabilityPackage {
  return createFirstClassToolingCapabilityPackage("docs.read");
}

export function listFirstClassToolingBaselineCapabilityPackages(): CapabilityPackage[] {
  return FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS.map((capabilityKey) =>
    createFirstClassToolingCapabilityPackage(capabilityKey),
  );
}

export function listFirstClassToolingCapabilityBaselineDescriptors(): FirstClassToolingCapabilityBaselineDescriptor[] {
  return FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS.map((capabilityKey) =>
    getFirstClassToolingCapabilityBaselineDescriptor(capabilityKey),
  );
}

export function createCapabilityManifestFromPackage(
  capabilityPackage: CapabilityPackage,
): CapabilityManifest {
  return {
    capabilityId: `capability:${capabilityPackage.manifest.capabilityKey}:${capabilityPackage.manifest.generation}`,
    capabilityKey: capabilityPackage.manifest.capabilityKey,
    kind: capabilityPackage.manifest.capabilityKind,
    version: capabilityPackage.manifest.version,
    generation: capabilityPackage.manifest.generation,
    description: capabilityPackage.manifest.description,
    supportsPrepare: true,
    routeHints: capabilityPackage.manifest.routeHints,
    tags: capabilityPackage.manifest.tags,
    metadata: {
      supportedPlatforms: capabilityPackage.manifest.supportedPlatforms,
      packageTemplateVersion: capabilityPackage.templateVersion,
      ...(capabilityPackage.manifest.metadata ?? {}),
      ...(capabilityPackage.metadata ?? {}),
    },
  };
}
