import path from "node:path";
import { readFile, readdir, realpath, stat } from "node:fs/promises";

import {
  createCapabilityManifestFromPackage,
  createCodeReadCapabilityPackage,
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
  lineStart?: number;
  lineEnd?: number;
  maxBytes: number;
  maxEntries: number;
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
      regex += ".*";
      index += 1;
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
  const operation = asString(input.operation) ?? "read_file";
  const requestedPath = asString(input.path);
  if (!requestedPath) {
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
    lineStart: asPositiveInteger(input.lineStart),
    lineEnd: asPositiveInteger(input.lineEnd),
    maxBytes: asPositiveInteger(input.maxBytes) ?? 64 * 1024,
    maxEntries: asPositiveInteger(input.maxEntries) ?? 100,
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

      const target = await resolveWorkspaceTarget(
        this.#workspaceRoot,
        parsed.path!,
      );
      if (!matchesPathPattern(target.relativePath, this.#allowedPathPatterns)) {
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
          const directory = await readdir(target.absolutePath, {
            withFileTypes: true,
          });
          const entries = directory
            .slice(0, parsed.maxEntries)
            .map((entry) => ({
              name: entry.name,
              path: normalizePathForMatch(
                path.posix.join(target.relativePath, entry.name),
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
              path: target.relativePath,
              entries,
              truncated: partial,
              totalEntries: directory.length,
            },
            metadata: this.#createResultMetadata(),
          });
        }
        case "stat_path": {
          const stats = await stat(target.absolutePath);
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "success",
            output: {
              capabilityKey: this.#capabilityKey,
              operation: parsed.operation,
              path: target.relativePath,
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
        case "read_lines":
        case "read_file": {
          const raw = await readFile(target.absolutePath, "utf8");
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
              path: target.relativePath,
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
