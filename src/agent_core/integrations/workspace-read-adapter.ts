import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { promisify } from "node:util";

import {
  createCapabilityManifestFromPackage,
  createCodeReadCapabilityPackage,
  createCodeLsCapabilityPackage,
  createCodeGlobCapabilityPackage,
  createCodeGrepCapabilityPackage,
  createCodeReadManyCapabilityPackage,
  createCodeSymbolSearchCapabilityPackage,
  createCodeLspCapabilityPackage,
  createReadPdfCapabilityPackage,
  createReadNotebookCapabilityPackage,
  createDocsReadCapabilityPackage,
  FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS,
  FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS,
  getFirstClassToolingCapabilityBaselineDescriptor,
  type FirstClassToolingCapabilityBaselineDescriptor,
  type FirstClassToolingAllowedOperation,
  type FirstClassToolingBaselineCapabilityKey,
} from "../capability-package/first-class-tooling-baseline.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { ActivationAdapterFactory } from "../ta-pool-runtime/index.js";

const require = createRequire(import.meta.url);
const ts: typeof import("typescript") = require("typescript");
const execFileAsync = promisify(execFile);

export interface WorkspaceReadAdapterOptions {
  workspaceRoot: string;
  capabilityKey: FirstClassToolingBaselineCapabilityKey;
  allowedPathPatterns: string[];
  allowedOperations?: readonly FirstClassToolingAllowedOperation[];
}

export interface WorkspaceReadActivationFactoryOptions {
  workspaceRoot: string;
  capabilityKey: FirstClassToolingBaselineCapabilityKey;
  allowedPathPatterns: string[];
  allowedOperations?: readonly FirstClassToolingAllowedOperation[];
}

export interface RegisterFirstClassToolingBaselineCapabilitiesInput {
  runtime: {
    registerCapabilityAdapter(
      manifest: CapabilityManifest,
      adapter: CapabilityAdapter,
    ): unknown;
    registerTaActivationFactory(
      ref: string,
      factory: ActivationAdapterFactory,
    ): void;
  };
  workspaceRoot: string;
  capabilityKeys?: readonly FirstClassToolingBaselineCapabilityKey[];
}

export interface RegisterFirstClassToolingBaselineCapabilitiesResult {
  capabilityKeys: FirstClassToolingBaselineCapabilityKey[];
  descriptors: FirstClassToolingCapabilityBaselineDescriptor[];
  manifests: CapabilityManifest[];
  packages: CapabilityPackage[];
  bindings: unknown[];
}

interface PreparedWorkspaceReadInput {
  capabilityKey: FirstClassToolingBaselineCapabilityKey;
  operation?: string;
  path?: string;
  paths?: string[];
  pattern?: string;
  query?: string;
  pages?: string;
  cellId?: string;
  include?: string[];
  exclude?: string[];
  lineStart?: number;
  lineEnd?: number;
  line?: number;
  character?: number;
  maxBytes: number;
  maxEntries: number;
  namesOnly?: boolean;
  maxMatchesPerFile?: number;
  invalidReason?: {
    status: "failed" | "blocked";
    code: string;
    message: string;
  };
}

interface ResolvedWorkspaceTarget {
  absolutePath: string;
  relativePath: string;
}

interface WorkspaceReadResultMetadata extends Record<string, unknown> {
  capabilityKey: FirstClassToolingBaselineCapabilityKey;
  runtimeKind: "workspace-read";
  baseline: "first-class-tooling";
  scopeKind: FirstClassToolingCapabilityBaselineDescriptor["scopeKind"];
  readOnly: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : undefined;
}

function normalizePathForMatch(value: string): string {
  return value
    .split(path.sep)
    .join("/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/");
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function pathPatternToRegex(pattern: string): RegExp {
  const normalized = normalizePathForMatch(pattern.trim());
  if (normalized.endsWith("/**")) {
    const base = escapeRegex(normalized.slice(0, -3));
    return new RegExp(`^${base}(?:/.*)?$`);
  }

  let regex = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      const nextAfterGlob = normalized[index + 2];
      if (nextAfterGlob === "/") {
        regex += "(?:.*/)?";
        index += 2;
      } else {
        regex += ".*";
        index += 1;
      }
      continue;
    }
    if (char === "*") {
      regex += "[^/]*";
      continue;
    }
    regex += escapeRegex(char);
  }
  return new RegExp(`^${regex}$`);
}

function matchesPathPattern(
  relativePath: string,
  patterns: readonly string[],
): boolean {
  return patterns.some((pattern) =>
    pathPatternToRegex(pattern).test(relativePath),
  );
}

function normalizeAllowedOperations(
  operations?: readonly string[],
): FirstClassToolingAllowedOperation[] {
  const normalized =
    operations && operations.length > 0
      ? operations
      : FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS;
  return [
    ...new Set(
      normalized
        .filter((value): value is FirstClassToolingAllowedOperation =>
          FIRST_CLASS_TOOLING_ALLOWED_OPERATIONS.includes(
            value as FirstClassToolingAllowedOperation,
          ),
        )
        .map((value) => value.trim() as FirstClassToolingAllowedOperation),
    ),
  ];
}

function truncateUtf8ByBytes(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) {
    return value;
  }

  let truncated = "";
  for (const char of value) {
    const next = truncated + char;
    if (Buffer.byteLength(next, "utf8") > maxBytes) {
      break;
    }
    truncated = next;
  }
  return truncated;
}

function parsePreparedWorkspaceReadInput(
  capabilityKey: FirstClassToolingBaselineCapabilityKey,
  input: Record<string, unknown>,
): PreparedWorkspaceReadInput {
  const operation = asString(input.operation)
    ?? (capabilityKey === "code.ls"
      ? "list_dir"
      : capabilityKey === "code.glob"
        ? "glob"
        : capabilityKey === "code.grep"
          ? "grep"
          : capabilityKey === "code.read_many"
            ? "read_many"
            : capabilityKey === "code.symbol_search"
              ? "workspace_symbol"
              : capabilityKey === "code.lsp"
                ? "document_symbol"
                : capabilityKey === "read_pdf"
                  ? "read_pdf"
                  : capabilityKey === "read_notebook"
                    ? "read_notebook"
            : "read_file");
  const requestedPath = asString(input.path)
    ?? asString(input.file_path)
    ?? asString(input.filePath)
    ?? asString(input.dir_path)
    ?? asString(input.cwd)
    ?? (capabilityKey === "code.ls" || capabilityKey === "code.glob" || capabilityKey === "code.grep" || capabilityKey === "code.read_many"
      || capabilityKey === "code.symbol_search"
      ? "."
      : undefined);
  const pattern = asString(input.pattern) ?? asString(input.glob);
  const query = asString(input.query)
    ?? asString(input.symbol)
    ?? asString(input.name)
    ?? pattern;
  const pages = asString(input.pages);
  const cellId = asString(input.cellId) ?? asString(input.cell_id);
  const include = asStringArray(input.include);
  const exclude = asStringArray(input.exclude);
  const requiresPath = !(
    capabilityKey === "code.symbol_search"
    || (capabilityKey === "code.lsp" && operation === "workspace_symbol")
  );
  if (!requestedPath && requiresPath) {
    return {
      capabilityKey,
      operation,
      maxBytes: 64 * 1024,
      maxEntries: 100,
      invalidReason: {
        status: "failed",
        code: "workspace_read_missing_path",
        message: `${capabilityKey} requires a non-empty path.`,
      },
    };
  }

  return {
    capabilityKey,
    operation,
    path: requestedPath,
    paths: asStringArray(input.paths),
    pattern,
    query,
    pages,
    cellId,
    include,
    exclude,
    lineStart: asPositiveInteger(input.lineStart),
    lineEnd: asPositiveInteger(input.lineEnd),
    line: asPositiveInteger(input.line),
    character: asPositiveInteger(input.character) ?? asPositiveInteger(input.column),
    maxBytes: asPositiveInteger(input.maxBytes) ?? 64 * 1024,
    maxEntries: asPositiveInteger(input.maxEntries) ?? 100,
    namesOnly: input.namesOnly === true,
    maxMatchesPerFile: asPositiveInteger(input.maxMatchesPerFile) ?? 20,
  };
}

async function resolveWorkspaceTarget(
  workspaceRoot: string,
  requestedPath: string,
): Promise<ResolvedWorkspaceTarget> {
  const absoluteCandidate = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(workspaceRoot, requestedPath);
  const workspaceReal = await realpath(workspaceRoot);
  const targetReal = await realpath(absoluteCandidate);

  if (
    targetReal !== workspaceReal &&
    !targetReal.startsWith(`${workspaceReal}${path.sep}`)
  ) {
    throw new Error(
      `Requested path ${requestedPath} escapes the configured workspace root.`,
    );
  }

  const relativePath = normalizePathForMatch(
    path.relative(workspaceReal, targetReal),
  );
  return {
    absolutePath: targetReal,
    relativePath,
  };
}

function createFailureEnvelope(params: {
  prepared: PreparedCapabilityCall;
  status: "failed" | "blocked";
  code: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  return createCapabilityResultEnvelope({
    executionId: params.prepared.preparedId,
    status: params.status,
    error: {
      code: params.code,
      message: params.message,
      details: params.details,
    },
    metadata: {
      capabilityKey: params.prepared.capabilityKey,
      runtimeKind: "workspace-read",
    },
  });
}

async function walkWorkspaceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkWorkspaceFiles(absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function matchesAnyPattern(candidate: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => pathPatternToRegex(pattern).test(candidate));
}

async function collectScopedFiles(params: {
  workspaceRoot: string;
  basePath: string;
  allowedPathPatterns: readonly string[];
}): Promise<Array<{ absolutePath: string; relativePath: string }>> {
  const target = await resolveWorkspaceTarget(params.workspaceRoot, params.basePath);
  const targetStats = await stat(target.absolutePath);
  const candidates = targetStats.isDirectory()
    ? await walkWorkspaceFiles(target.absolutePath)
    : [target.absolutePath];

  return candidates
    .map((absolutePath) => {
      const relativePath = normalizePathForMatch(path.relative(params.workspaceRoot, absolutePath));
      return { absolutePath, relativePath };
    })
    .filter((entry) => matchesPathPattern(entry.relativePath, params.allowedPathPatterns));
}

function normalizeGlobLikePattern(value: string): string {
  return normalizePathForMatch(value.trim()).replace(/^\.\//, "");
}

function matchesGlobLikePattern(candidate: string, pattern: string): boolean {
  return pathPatternToRegex(normalizeGlobLikePattern(pattern)).test(candidate);
}

function buildReadManyFileSelection(params: {
  files: Array<{ absolutePath: string; relativePath: string }>;
  include?: string[];
  exclude?: string[];
  maxEntries: number;
}): Array<{ absolutePath: string; relativePath: string }> {
  const includePatterns = params.include?.map(normalizeGlobLikePattern);
  const excludePatterns = params.exclude?.map(normalizeGlobLikePattern) ?? [];

  return params.files
    .filter((entry) =>
      includePatterns && includePatterns.length > 0
        ? matchesAnyPattern(entry.relativePath, includePatterns)
        : true)
    .filter((entry) =>
      excludePatterns.length > 0
        ? !matchesAnyPattern(entry.relativePath, excludePatterns)
        : true)
    .slice(0, params.maxEntries);
}

function buildGrepRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "gm");
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  }
}

const TYPESCRIPT_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function isTypeScriptSourceFile(filePath: string): boolean {
  return TYPESCRIPT_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

interface TypeScriptWorkspaceContext {
  service: import("typescript").LanguageService;
  compilerOptions: import("typescript").CompilerOptions;
  fileNames: string[];
}

function loadTypeScriptCompilerOptions(
  workspaceRoot: string,
): import("typescript").CompilerOptions {
  const tsConfigPath = ts.findConfigFile(
    workspaceRoot,
    ts.sys.fileExists,
    "tsconfig.json",
  );
  if (!tsConfigPath) {
    return {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      jsx: ts.JsxEmit.Preserve,
    };
  }

  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (configFile.error) {
    return {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      jsx: ts.JsxEmit.Preserve,
    };
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsConfigPath),
  );
  return {
    ...parsed.options,
    allowJs: parsed.options.allowJs ?? true,
  };
}

function createTypeScriptWorkspaceContext(params: {
  workspaceRoot: string;
  files: Array<{ absolutePath: string; relativePath: string }>;
  extraFiles?: string[];
}): TypeScriptWorkspaceContext | undefined {
  const baseFileNames = params.files
    .map((entry) => entry.absolutePath)
    .filter(isTypeScriptSourceFile);
  const extraFileNames = (params.extraFiles ?? [])
    .map((filePath) => path.resolve(params.workspaceRoot, filePath))
    .filter(isTypeScriptSourceFile);
  const fileNames = [...new Set([...baseFileNames, ...extraFileNames])];
  if (fileNames.length === 0) {
    return undefined;
  }

  const compilerOptions = loadTypeScriptCompilerOptions(params.workspaceRoot);
  const versions = new Map<string, string>();
  const host: import("typescript").LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => fileNames,
    getScriptVersion: (fileName) => versions.get(fileName) ?? "0",
    getScriptSnapshot: (fileName) => {
      const content = ts.sys.readFile(fileName);
      return typeof content === "string"
        ? ts.ScriptSnapshot.fromString(content)
        : undefined;
    },
    getCurrentDirectory: () => params.workspaceRoot,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  return {
    service: ts.createLanguageService(host, ts.createDocumentRegistry()),
    compilerOptions,
    fileNames,
  };
}

function getSourceFileFromContext(
  context: TypeScriptWorkspaceContext,
  absolutePath: string,
): import("typescript").SourceFile | undefined {
  return context.service.getProgram()?.getSourceFile(absolutePath);
}

function toLineCharacter(
  sourceFile: import("typescript").SourceFile,
  position: number,
) {
  const location = ts.getLineAndCharacterOfPosition(sourceFile, position);
  return {
    line: location.line + 1,
    character: location.character + 1,
  };
}

function toOffset(
  sourceFile: import("typescript").SourceFile,
  line: number,
  character: number,
): number {
  return ts.getPositionOfLineAndCharacter(
    sourceFile,
    Math.max(line - 1, 0),
    Math.max(character - 1, 0),
  );
}

function flattenNavigationTree(
  tree: import("typescript").NavigationTree,
  sourceFile: import("typescript").SourceFile,
  relativePath: string,
  depth = 0,
  containerName?: string,
): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const shouldSkipSyntheticRootModule = depth === 0
    && tree.kind === "module"
    && /^".+"$/u.test(tree.text);
  if (tree.text && tree.text !== "<global>" && !shouldSkipSyntheticRootModule) {
    const primarySpan = tree.nameSpan ?? tree.spans[0];
    const location = primarySpan
      ? toLineCharacter(sourceFile, primarySpan.start)
      : { line: 1, character: 1 };
    results.push({
      name: tree.text,
      kind: tree.kind,
      path: relativePath,
      line: location.line,
      character: location.character,
      depth,
      containerName,
    });
  }

  for (const child of tree.childItems ?? []) {
    results.push(
      ...flattenNavigationTree(
        child,
        sourceFile,
        relativePath,
        depth + 1,
        tree.text === "<global>" ? containerName : tree.text,
      ),
    );
  }

  return results;
}

async function fallbackTextSymbolSearch(params: {
  files: Array<{ absolutePath: string; relativePath: string }>;
  query: string;
  maxEntries: number;
}): Promise<Array<Record<string, unknown>>> {
  const escaped = escapeRegex(params.query);
  const regex = new RegExp(`\\b${escaped}\\b`);
  const results: Array<Record<string, unknown>> = [];

  for (const file of params.files) {
    const content = await readFile(file.absolutePath, "utf8");
    const lines = content.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const matchIndex = line.search(regex);
      if (matchIndex < 0) {
        continue;
      }
      results.push({
        name: params.query,
        kind: "text",
        path: file.relativePath,
        line: index + 1,
        character: matchIndex + 1,
        preview: line.trim(),
      });
      if (results.length >= params.maxEntries) {
        return results;
      }
    }
  }

  return results;
}

function parsePageRange(
  value: string | undefined,
): { firstPage?: number; lastPage?: number } {
  if (!value || value.trim().length === 0) {
    return {};
  }

  const normalized = value.trim();
  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/u);
  if (rangeMatch) {
    const firstPage = Number.parseInt(rangeMatch[1]!, 10);
    const lastPage = Number.parseInt(rangeMatch[2]!, 10);
    if (firstPage <= 0 || lastPage <= 0 || lastPage < firstPage) {
      throw new Error(`Invalid PDF page range: ${value}`);
    }
    return { firstPage, lastPage };
  }

  const singlePage = Number.parseInt(normalized, 10);
  if (Number.isInteger(singlePage) && singlePage > 0) {
    return { firstPage: singlePage, lastPage: singlePage };
  }

  throw new Error(`Invalid PDF page range: ${value}`);
}

async function runWorkspaceCommand(params: {
  command: string;
  args: string[];
}): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(params.command, params.args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
    };
  } catch (error) {
    const details = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    throw new Error(details.stderr?.trim() || details.message || `Failed to run ${params.command}.`);
  }
}

async function readPdfSummary(params: {
  absolutePath: string;
  relativePath: string;
  maxBytes: number;
  pages?: string;
}) {
  const pageRange = parsePageRange(params.pages);
  const info = await runWorkspaceCommand({
    command: "pdfinfo",
    args: [params.absolutePath],
  });
  const pageCountMatch = info.stdout.match(/^Pages:\s+(\d+)/mu);
  const pageCount = pageCountMatch
    ? Number.parseInt(pageCountMatch[1]!, 10)
    : undefined;
  const args = ["-layout", "-nopgbrk"];
  if (pageRange.firstPage) {
    args.push("-f", String(pageRange.firstPage));
  }
  if (pageRange.lastPage) {
    args.push("-l", String(pageRange.lastPage));
  }
  args.push(params.absolutePath, "-");
  const extraction = await runWorkspaceCommand({
    command: "pdftotext",
    args,
  });
  const text = extraction.stdout.trim();
  const content = truncateUtf8ByBytes(text, params.maxBytes);
  return {
    capabilityKey: "read_pdf",
    operation: "read_pdf",
    path: params.relativePath,
    pageCount,
    pages: params.pages,
    content,
    truncated: Buffer.byteLength(text, "utf8") > params.maxBytes,
    extractedBytes: Buffer.byteLength(text, "utf8"),
  };
}

function summarizeNotebookOutput(output: Record<string, unknown>): string | undefined {
  const outputType = asString(output.output_type) ?? "unknown";
  if (outputType === "stream") {
    const text = output.text;
    if (typeof text === "string") {
      return text;
    }
    if (Array.isArray(text)) {
      return text.filter((entry): entry is string => typeof entry === "string").join("");
    }
  }
  if (outputType === "error") {
    const ename = asString(output.ename) ?? "Error";
    const evalue = asString(output.evalue) ?? "";
    return `${ename}: ${evalue}`.trim();
  }
  const data = isRecord(output.data) ? output.data : undefined;
  const plain = data?.["text/plain"];
  if (typeof plain === "string") {
    return plain;
  }
  if (Array.isArray(plain)) {
    return plain.filter((entry): entry is string => typeof entry === "string").join("");
  }
  if (data && (typeof data["image/png"] === "string" || typeof data["image/jpeg"] === "string")) {
    return "[image output]";
  }
  return undefined;
}

async function readNotebookSummary(params: {
  absolutePath: string;
  relativePath: string;
  maxBytes: number;
  maxEntries: number;
  cellId?: string;
}) {
  const raw = await readFile(params.absolutePath, "utf8");
  const notebook = JSON.parse(raw) as {
    cells?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  };
  const allCells = Array.isArray(notebook.cells) ? notebook.cells : [];
  const selectedCells = params.cellId
    ? allCells.filter((cell) => asString(cell.id) === params.cellId)
    : allCells;
  const cells = selectedCells.slice(0, params.maxEntries).map((cell, index) => {
    const source = cell.source;
    const sourceText = Array.isArray(source)
      ? source.filter((entry): entry is string => typeof entry === "string").join("")
      : typeof source === "string"
        ? source
        : "";
    const outputs = Array.isArray(cell.outputs)
      ? cell.outputs
        .filter(isRecord)
        .slice(0, 3)
        .map(summarizeNotebookOutput)
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
    return {
      cellId: asString(cell.id) ?? `cell-${index}`,
      cellType: asString(cell.cell_type) ?? "unknown",
      executionCount: typeof cell.execution_count === "number" ? cell.execution_count : undefined,
      source: truncateUtf8ByBytes(sourceText, Math.max(512, Math.floor(params.maxBytes / Math.max(1, params.maxEntries)))),
      outputs: outputs.map((entry) => truncateUtf8ByBytes(entry, 400)),
    };
  });
  return {
    capabilityKey: "read_notebook",
    operation: "read_notebook",
    path: params.relativePath,
    cellCount: allCells.length,
    returnedCellCount: cells.length,
    language: isRecord(notebook.metadata?.language_info)
      ? asString((notebook.metadata?.language_info as Record<string, unknown>).name)
      : undefined,
    cells,
    truncated: selectedCells.length > params.maxEntries,
  };
}

export class WorkspaceReadCapabilityAdapter implements CapabilityAdapter {
  readonly id: string;
  readonly runtimeKind = "workspace-read";
  readonly #workspaceRoot: string;
  readonly #capabilityKey: FirstClassToolingBaselineCapabilityKey;
  readonly #descriptor: FirstClassToolingCapabilityBaselineDescriptor;
  readonly #allowedPathPatterns: string[];
  readonly #allowedOperations: FirstClassToolingAllowedOperation[];
  readonly #preparedInputs = new Map<string, PreparedWorkspaceReadInput>();

  constructor(options: WorkspaceReadAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#capabilityKey = options.capabilityKey;
    this.#descriptor = getFirstClassToolingCapabilityBaselineDescriptor(
      this.#capabilityKey,
    );
    this.#allowedPathPatterns = [
      ...new Set(
        options.allowedPathPatterns
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    this.#allowedOperations = normalizeAllowedOperations(
      options.allowedOperations,
    );
    this.id = `adapter:${this.#capabilityKey}`;
  }

  #createResultMetadata(): WorkspaceReadResultMetadata {
    return {
      capabilityKey: this.#capabilityKey,
      runtimeKind: this.runtimeKind,
      baseline: "first-class-tooling",
      scopeKind: this.#descriptor.scopeKind,
      readOnly: true,
    };
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    return plan.capabilityKey === this.#capabilityKey;
  }

  async prepare(
    plan: CapabilityInvocationPlan,
    lease: CapabilityLease,
  ): Promise<PreparedCapabilityCall> {
    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: "direct",
      preparedPayloadRef: `workspace-read:${plan.planId}`,
      cacheKey: lease.preparedCacheKey ?? plan.idempotencyKey,
      metadata: {
        workspaceRoot: this.#workspaceRoot,
      },
    });

    this.#preparedInputs.set(
      prepared.preparedId,
      parsePreparedWorkspaceReadInput(
        this.#capabilityKey,
        isRecord(plan.input) ? plan.input : {},
      ),
    );
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const parsed = this.#preparedInputs.get(prepared.preparedId);
    if (!parsed) {
      return createFailureEnvelope({
        prepared,
        status: "failed",
        code: "workspace_read_prepared_input_missing",
        message: `Prepared workspace read input for ${prepared.preparedId} was not found.`,
      });
    }

    try {
      if (parsed.invalidReason) {
        return createFailureEnvelope({
          prepared,
          status: parsed.invalidReason.status,
          code: parsed.invalidReason.code,
          message: parsed.invalidReason.message,
        });
      }

      if (
        !this.#allowedOperations.includes(
          parsed.operation as FirstClassToolingAllowedOperation,
        )
      ) {
        return createFailureEnvelope({
          prepared,
          status: "blocked",
          code: "workspace_read_operation_not_allowed",
          message: `Operation ${parsed.operation} is not allowed for ${this.#capabilityKey}.`,
          details: {
            allowedOperations: this.#allowedOperations,
          },
        });
      }

      const target = parsed.path
        ? await resolveWorkspaceTarget(
          this.#workspaceRoot,
          parsed.path,
        )
        : undefined;
      const allowRootScopedDiscovery = target?.relativePath === ""
        && (
          parsed.operation === "glob"
          || parsed.operation === "grep"
          || parsed.operation === "read_many"
          || parsed.operation === "workspace_symbol"
        );
      if (
        target
        && !allowRootScopedDiscovery
        && !matchesPathPattern(target.relativePath, this.#allowedPathPatterns)
      ) {
        return createFailureEnvelope({
          prepared,
          status: "blocked",
          code: "workspace_read_path_not_allowed",
          message: `Path ${target.relativePath} is outside the allowed scope for ${this.#capabilityKey}.`,
          details: {
            allowedPathPatterns: this.#allowedPathPatterns,
          },
        });
      }

      switch (parsed.operation) {
        case "list_dir": {
          const directory = await readdir(target!.absolutePath, {
            withFileTypes: true,
          });
          const entries = directory
            .slice(0, parsed.maxEntries)
            .map((entry) => ({
              name: entry.name,
              path: normalizePathForMatch(
                path.posix.join(target!.relativePath, entry.name),
              ),
              kind: entry.isDirectory()
                ? "directory"
                : entry.isFile()
                  ? "file"
                  : "other",
            }));
          const partial = directory.length > parsed.maxEntries;
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: partial ? "partial" : "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: target!.relativePath,
              entries,
              truncated: partial,
              totalEntries: directory.length,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "stat_path": {
          const stats = await stat(target!.absolutePath);
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: target!.relativePath,
              kind: stats.isDirectory()
                ? "directory"
                : stats.isFile()
                  ? "file"
                  : "other",
              size: stats.size,
              modifiedAt: stats.mtime.toISOString(),
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "glob": {
          if (!parsed.pattern) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_pattern",
              message: `${this.#capabilityKey} requires a glob pattern.`,
            });
          }
          const files = await collectScopedFiles({
            workspaceRoot: this.#workspaceRoot,
            basePath: parsed.path!,
            allowedPathPatterns: this.#allowedPathPatterns,
          });
          const matches = files
            .filter((entry) => matchesGlobLikePattern(entry.relativePath, parsed.pattern!))
            .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
            .slice(0, parsed.maxEntries)
            .map((entry) => entry.relativePath);
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: normalizePathForMatch(parsed.path!),
              pattern: parsed.pattern,
              matches,
              truncated: files.length > matches.length,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "grep": {
          const pattern = parsed.pattern;
          if (!pattern) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_pattern",
              message: `${this.#capabilityKey} requires a grep pattern.`,
            });
          }
          const regex = buildGrepRegex(pattern);
          const files = buildReadManyFileSelection({
            files: await collectScopedFiles({
              workspaceRoot: this.#workspaceRoot,
              basePath: parsed.path!,
              allowedPathPatterns: this.#allowedPathPatterns,
            }),
            include: parsed.include,
            exclude: parsed.exclude,
            maxEntries: parsed.maxEntries,
          });
          const matches: Array<Record<string, unknown>> = [];
          for (const file of files) {
            const content = await readFile(file.absolutePath, "utf8");
            const lines = content.split(/\r?\n/u);
            let matchCountForFile = 0;
            for (let index = 0; index < lines.length; index += 1) {
              const line = lines[index]!;
              regex.lastIndex = 0;
              if (!regex.test(line)) {
                continue;
              }
              matches.push({
                path: file.relativePath,
                lineNumber: index + 1,
                line,
              });
              matchCountForFile += 1;
              if (matchCountForFile >= (parsed.maxMatchesPerFile ?? 20)) {
                break;
              }
              if (matches.length >= parsed.maxEntries) {
                break;
              }
            }
            if (matches.length >= parsed.maxEntries) {
              break;
            }
          }
          const normalizedMatches = parsed.namesOnly
            ? [...new Set(matches.map((entry) => String(entry.path)))].map((filePath) => ({ path: filePath }))
            : matches;
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: normalizePathForMatch(parsed.path!),
              pattern,
              matches: normalizedMatches,
              namesOnly: parsed.namesOnly === true,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "read_many": {
          const explicitPaths = parsed.paths;
          const scopedFiles = explicitPaths && explicitPaths.length > 0
            ? await Promise.all(explicitPaths.map(async (item) => {
              const resolved = await resolveWorkspaceTarget(this.#workspaceRoot, item);
              return {
                absolutePath: resolved.absolutePath,
                relativePath: resolved.relativePath,
              };
            }))
            : buildReadManyFileSelection({
              files: await collectScopedFiles({
                workspaceRoot: this.#workspaceRoot,
                basePath: parsed.path!,
                allowedPathPatterns: this.#allowedPathPatterns,
              }),
              include: parsed.include,
              exclude: parsed.exclude,
              maxEntries: parsed.maxEntries,
            });
          const documents = [];
          for (const file of scopedFiles.slice(0, parsed.maxEntries)) {
            if (!matchesPathPattern(file.relativePath, this.#allowedPathPatterns)) {
              continue;
            }
            const raw = await readFile(file.absolutePath, "utf8");
            const content = Buffer.byteLength(raw, "utf8") > parsed.maxBytes
              ? truncateUtf8ByBytes(raw, parsed.maxBytes)
              : raw;
            documents.push({
              path: file.relativePath,
              content,
              truncated: Buffer.byteLength(raw, "utf8") > parsed.maxBytes,
            });
          }
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              documents,
              count: documents.length,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "read_pdf": {
          if (!target) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_path",
              message: `${this.#capabilityKey} requires a non-empty file path.`,
            });
          }
          const summary = await readPdfSummary({
            absolutePath: target.absolutePath,
            relativePath: target.relativePath,
            maxBytes: parsed.maxBytes,
            pages: parsed.pages,
          });
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: summary.truncated ? "partial" : "success",
            output: summary,
            metadata: this.#createResultMetadata(),
          });
        }
        case "read_notebook": {
          if (!target) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_path",
              message: `${this.#capabilityKey} requires a non-empty file path.`,
            });
          }
          const summary = await readNotebookSummary({
            absolutePath: target.absolutePath,
            relativePath: target.relativePath,
            maxBytes: parsed.maxBytes,
            maxEntries: parsed.maxEntries,
            cellId: parsed.cellId,
          });
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: summary.truncated ? "partial" : "success",
            output: summary,
            metadata: this.#createResultMetadata(),
          });
        }
        case "workspace_symbol": {
          const query = parsed.query?.trim();
          if (!query) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_query",
              message: `${this.#capabilityKey} requires a non-empty query or symbol.`,
            });
          }
          const scopedFiles = await collectScopedFiles({
            workspaceRoot: this.#workspaceRoot,
            basePath: parsed.path ?? ".",
            allowedPathPatterns: this.#allowedPathPatterns,
          });
          const typeScriptContext = createTypeScriptWorkspaceContext({
            workspaceRoot: this.#workspaceRoot,
            files: scopedFiles,
          });

          let backend = "text-grep-fallback";
          let matches: Array<Record<string, unknown>> = [];
          if (typeScriptContext) {
            matches = typeScriptContext.service
              .getNavigateToItems(query, parsed.maxEntries)
              .map((item) => {
                const sourceFile = getSourceFileFromContext(
                  typeScriptContext,
                  item.fileName,
                );
                const relativePath = normalizePathForMatch(
                  path.relative(this.#workspaceRoot, item.fileName),
                );
                const location = sourceFile
                  ? toLineCharacter(sourceFile, item.textSpan.start)
                  : { line: 1, character: 1 };
                return {
                  name: item.name,
                  kind: item.kind,
                  path: relativePath,
                  line: location.line,
                  character: location.character,
                  containerName: item.containerName,
                  matchKind: item.matchKind,
                };
              })
              .filter((entry) =>
                typeof entry.path === "string"
                && matchesPathPattern(entry.path, this.#allowedPathPatterns))
              .slice(0, parsed.maxEntries);
            if (matches.length > 0) {
              backend = "typescript-language-service";
            }
          }

          if (matches.length === 0) {
            matches = await fallbackTextSymbolSearch({
              files: scopedFiles,
              query,
              maxEntries: parsed.maxEntries,
            });
          }

          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: normalizePathForMatch(parsed.path ?? "."),
              query,
              backend,
              matches,
              resultCount: matches.length,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "document_symbol":
        case "definition":
        case "references":
        case "hover": {
          if (!target) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_path",
              message: `${this.#capabilityKey} requires a non-empty file path.`,
            });
          }
          const scopedFiles = await collectScopedFiles({
            workspaceRoot: this.#workspaceRoot,
            basePath: ".",
            allowedPathPatterns: this.#allowedPathPatterns,
          });
          const typeScriptContext = createTypeScriptWorkspaceContext({
            workspaceRoot: this.#workspaceRoot,
            files: scopedFiles,
            extraFiles: [target.absolutePath],
          });
          if (!typeScriptContext || !isTypeScriptSourceFile(target.absolutePath)) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_lsp_unsupported_file",
              message: `${this.#capabilityKey} currently supports TypeScript and JavaScript source files only.`,
            });
          }

          const sourceFile = getSourceFileFromContext(
            typeScriptContext,
            target.absolutePath,
          );
          if (!sourceFile) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_lsp_source_missing",
              message: `Unable to load ${target.relativePath} into the TypeScript language service.`,
            });
          }

          const service = typeScriptContext.service;
          if (parsed.operation === "document_symbol") {
            const tree = service.getNavigationTree(target.absolutePath);
            const symbols = flattenNavigationTree(
              tree,
              sourceFile,
              target.relativePath,
            ).slice(0, parsed.maxEntries);
            return createCapabilityResultEnvelope({
              executionId: prepared.preparedId,
              status: "success",
              output: {
                capabilityKey: this.#capabilityKey,
                operation: parsed.operation,
                path: target.relativePath,
                backend: "typescript-language-service",
                symbols,
                resultCount: symbols.length,
              },
              metadata: this.#createResultMetadata(),
            });
          }

          if (!parsed.line || !parsed.character) {
            return createFailureEnvelope({
              prepared,
              status: "failed",
              code: "workspace_read_missing_position",
              message: `${this.#capabilityKey} requires line and character for ${parsed.operation}.`,
            });
          }
          const offset = toOffset(sourceFile, parsed.line, parsed.character);

          if (parsed.operation === "definition") {
            const definitions = (service
              .getDefinitionAtPosition(target.absolutePath, offset) ?? [])
              .map((entry) => {
                const definitionSource = getSourceFileFromContext(
                  typeScriptContext,
                  entry.fileName,
                );
                const relativePath = normalizePathForMatch(
                  path.relative(this.#workspaceRoot, entry.fileName),
                );
                const location = definitionSource
                  ? toLineCharacter(definitionSource, entry.textSpan.start)
                  : { line: 1, character: 1 };
                return {
                  path: relativePath,
                  line: location.line,
                  character: location.character,
                  kind: entry.kind,
                  name: entry.name,
                  containerName: entry.containerName,
                };
              })
              .filter((entry) => matchesPathPattern(entry.path, this.#allowedPathPatterns))
              .slice(0, parsed.maxEntries);
            return createCapabilityResultEnvelope({
              executionId: prepared.preparedId,
              status: "success",
              output: {
                capabilityKey: this.#capabilityKey,
                operation: parsed.operation,
                path: target.relativePath,
                line: parsed.line,
                character: parsed.character,
                backend: "typescript-language-service",
                definitions,
                resultCount: definitions.length,
              },
              metadata: this.#createResultMetadata(),
            });
          }

          if (parsed.operation === "references") {
            const references = (service.getReferencesAtPosition(target.absolutePath, offset) ?? [])
              .map((entry) => {
                const referenceSource = getSourceFileFromContext(
                  typeScriptContext,
                  entry.fileName,
                );
                const relativePath = normalizePathForMatch(
                  path.relative(this.#workspaceRoot, entry.fileName),
                );
                const location = referenceSource
                  ? toLineCharacter(referenceSource, entry.textSpan.start)
                  : { line: 1, character: 1 };
                return {
                  path: relativePath,
                  line: location.line,
                  character: location.character,
                  isWriteAccess: entry.isWriteAccess,
                };
              })
              .filter((entry) => matchesPathPattern(entry.path, this.#allowedPathPatterns))
              .slice(0, parsed.maxEntries);
            return createCapabilityResultEnvelope({
              executionId: prepared.preparedId,
              status: "success",
              output: {
                capabilityKey: this.#capabilityKey,
                operation: parsed.operation,
                path: target.relativePath,
                line: parsed.line,
                character: parsed.character,
                backend: "typescript-language-service",
                references,
                resultCount: references.length,
              },
              metadata: this.#createResultMetadata(),
            });
          }

          const quickInfo = service.getQuickInfoAtPosition(
            target.absolutePath,
            offset,
          );
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: target!.relativePath,
              line: parsed.line,
              character: parsed.character,
              backend: "typescript-language-service",
              hoverText: quickInfo
                ? ts.displayPartsToString(quickInfo.displayParts ?? [])
                : "",
              documentation: quickInfo
                ? ts.displayPartsToString(quickInfo.documentation ?? [])
                : "",
              resultCount: quickInfo ? 1 : 0,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "read_lines":
        case "read_file": {
          const raw = await readFile(target!.absolutePath, "utf8");
          const lines = raw.split(/\r?\n/u);
          const lineStart =
            parsed.operation === "read_lines"
              ? Math.max(parsed.lineStart ?? 1, 1)
              : 1;
          const lineEnd =
            parsed.operation === "read_lines"
              ? Math.max(parsed.lineEnd ?? lines.length, lineStart)
              : lines.length;
          const selected =
            parsed.operation === "read_lines"
              ? lines.slice(lineStart - 1, lineEnd).join("\n")
              : raw;
          const totalBytes = Buffer.byteLength(selected, "utf8");
          const content =
            totalBytes > parsed.maxBytes
              ? truncateUtf8ByBytes(selected, parsed.maxBytes)
              : selected;
          const partial = totalBytes > parsed.maxBytes;
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: partial ? "partial" : "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: target!.relativePath,
              content,
              lineStart,
              lineEnd,
              truncated: partial,
              totalBytes,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        default: {
          return createFailureEnvelope({
            prepared,
            status: "failed",
            code: "workspace_read_operation_unknown",
            message: `Unknown workspace read operation ${parsed.operation}.`,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const blocked = /escapes the configured workspace root/i.test(message);
      return createFailureEnvelope({
        prepared,
        status: blocked ? "blocked" : "failed",
        code: blocked
          ? "workspace_read_path_escape"
          : "workspace_read_execute_failed",
        message,
      });
    } finally {
      this.#preparedInputs.delete(prepared.preparedId);
    }
  }
}

export function createWorkspaceReadCapabilityAdapter(
  options: WorkspaceReadAdapterOptions,
): WorkspaceReadCapabilityAdapter {
  return new WorkspaceReadCapabilityAdapter(options);
}

export function createWorkspaceReadActivationFactory(
  options: WorkspaceReadActivationFactoryOptions,
): ActivationAdapterFactory {
  const defaults = {
    allowedPathPatterns: [...options.allowedPathPatterns],
    allowedOperations: normalizeAllowedOperations(options.allowedOperations),
  };

  return (context) => {
    const bindingPayload = isRecord(context.bindingPayload)
      ? context.bindingPayload
      : {};
    const allowedPathPatterns = Array.isArray(
      bindingPayload.allowedPathPatterns,
    )
      ? bindingPayload.allowedPathPatterns.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : defaults.allowedPathPatterns;
    const allowedOperations = Array.isArray(bindingPayload.allowedOperations)
      ? normalizeAllowedOperations(
          bindingPayload.allowedOperations.filter(
            (value): value is string => typeof value === "string",
          ),
        )
      : defaults.allowedOperations;

    return createWorkspaceReadCapabilityAdapter({
      workspaceRoot: options.workspaceRoot,
      capabilityKey: options.capabilityKey,
      allowedPathPatterns,
      allowedOperations,
    });
  };
}

export function registerFirstClassToolingBaselineCapabilities(
  input: RegisterFirstClassToolingBaselineCapabilitiesInput,
): RegisterFirstClassToolingBaselineCapabilitiesResult {
  const capabilityKeys = [
    ...(input.capabilityKeys ?? FIRST_CLASS_TOOLING_BASELINE_CAPABILITY_KEYS),
  ];
  const descriptors = capabilityKeys.map((capabilityKey) =>
    getFirstClassToolingCapabilityBaselineDescriptor(capabilityKey),
  );
  const packages = capabilityKeys.map((capabilityKey) =>
    capabilityKey === "code.read"
      ? createCodeReadCapabilityPackage()
      : capabilityKey === "code.ls"
        ? createCodeLsCapabilityPackage()
        : capabilityKey === "code.glob"
          ? createCodeGlobCapabilityPackage()
          : capabilityKey === "code.grep"
            ? createCodeGrepCapabilityPackage()
            : capabilityKey === "code.read_many"
            ? createCodeReadManyCapabilityPackage()
            : capabilityKey === "code.symbol_search"
              ? createCodeSymbolSearchCapabilityPackage()
              : capabilityKey === "code.lsp"
                ? createCodeLspCapabilityPackage()
                : capabilityKey === "read_pdf"
                  ? createReadPdfCapabilityPackage()
                  : capabilityKey === "read_notebook"
                    ? createReadNotebookCapabilityPackage()
                  : createDocsReadCapabilityPackage(),
  );
  const manifests = packages.map((capabilityPackage) =>
    createCapabilityManifestFromPackage(capabilityPackage),
  );
  const bindings = packages.map((capabilityPackage, index) => {
    const pathPatterns =
      capabilityPackage.policy.defaultBaseline.scope?.pathPatterns ?? [];
    const allowedOperations =
      capabilityPackage.policy.defaultBaseline.scope?.allowedOperations;
    const factory = createWorkspaceReadActivationFactory({
      workspaceRoot: input.workspaceRoot,
      capabilityKey: capabilityKeys[index]!,
      allowedPathPatterns: pathPatterns,
      allowedOperations: allowedOperations as
        | FirstClassToolingAllowedOperation[]
        | undefined,
    });
    const activationRef = capabilityPackage.activationSpec?.adapterFactoryRef;
    if (!activationRef) {
      throw new Error(
        `Capability package ${capabilityPackage.manifest.capabilityKey} is missing adapterFactoryRef.`,
      );
    }

    input.runtime.registerTaActivationFactory(activationRef, factory);
    const adapter = factory({
      capabilityPackage,
      activationSpec: capabilityPackage.activationSpec,
      bindingPayload: capabilityPackage.activationSpec?.bindingPayload,
      manifest: manifests[index],
      manifestPayload: capabilityPackage.activationSpec?.manifestPayload,
    });

    return input.runtime.registerCapabilityAdapter(manifests[index]!, adapter);
  });

  return {
    capabilityKeys,
    descriptors,
    manifests,
    packages,
    bindings,
  };
}
