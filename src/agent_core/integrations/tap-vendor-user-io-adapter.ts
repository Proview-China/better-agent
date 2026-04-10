import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import {
  createCapabilityManifestFromPackage,
  createTapVendorUserIoCapabilityPackage,
  TAP_VENDOR_USER_IO_ACTIVATION_FACTORY_REFS,
  TAP_VENDOR_USER_IO_CAPABILITY_KEYS,
  type TapVendorUserIoCapabilityKey,
} from "../capability-package/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { ReplayPolicy } from "../ta-pool-types/index.js";
import type { ActivationAdapterFactory } from "../ta-pool-runtime/index.js";
import { loadOpenAILiveConfig } from "../../rax/live-config.js";

export interface TapVendorUserIoAdapterOptions {
  capabilityKey?: TapVendorUserIoCapabilityKey;
  workspaceRoot?: string;
  openaiClientFactory?: () => OpenAI;
}

export interface TapVendorUserIoRegistrationTarget {
  registerCapabilityAdapter(
    manifest: CapabilityManifest,
    adapter: CapabilityAdapter,
  ): unknown;
  registerTaActivationFactory(
    ref: string,
    factory: ActivationAdapterFactory,
  ): void;
}

export interface RegisterTapVendorUserIoFamilyInput {
  runtime: TapVendorUserIoRegistrationTarget;
  capabilityKeys?: readonly TapVendorUserIoCapabilityKey[];
  replayPolicy?: ReplayPolicy;
}

export interface RegisterTapVendorUserIoFamilyResult {
  capabilityKeys: TapVendorUserIoCapabilityKey[];
  activationFactoryRefs: string[];
  manifests: CapabilityManifest[];
  packages: CapabilityPackage[];
  bindings: unknown[];
}

type AudioTranscriptionResponseFormat =
  "json"
  | "text"
  | "verbose_json"
  | "srt"
  | "vtt"
  | "diarized_json";

type PreparedUserIoState =
  | {
      capabilityKey: "request_user_input";
      payload: {
        questions: unknown[];
      };
    }
  | {
      capabilityKey: "request_permissions";
      payload: {
        permissions: Record<string, unknown>;
        reason?: string;
      };
    }
  | {
      capabilityKey: "audio.transcribe";
      payload: {
        absolutePath: string;
        relativePath: string;
        model: string;
        language?: string;
        prompt?: string;
        responseFormat?: AudioTranscriptionResponseFormat;
        include?: string[];
        knownSpeakerNames?: string[];
      };
    }
  | {
      capabilityKey: "speech.synthesize";
      payload: {
        input: string;
        model: string;
        voice: string;
        responseFormat: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
        instructions?: string;
        speed?: number;
        absoluteOutputPath: string;
        relativeOutputPath: string;
      };
    }
  | {
      capabilityKey: "image.generate";
      payload: {
        prompt: string;
        model: string;
        size?: string;
        quality?: string;
        background?: string;
        outputFormat: "png" | "jpeg" | "webp";
        absoluteOutputPath: string;
        relativeOutputPath: string;
      };
    };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function resolveInputPath(workspaceRoot: string, candidatePath: string): {
  absolutePath: string;
  relativePath: string;
} {
  const absolutePath = path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(workspaceRoot, candidatePath);
  return {
    absolutePath,
    relativePath: path.relative(workspaceRoot, absolutePath) || path.basename(absolutePath),
  };
}

function defaultGeneratedPath(params: {
  workspaceRoot: string;
  prefix: string;
  extension: string;
}): {
  absolutePath: string;
  relativePath: string;
} {
  const relativePath = path.join("memory", "generated", `${params.prefix}-${Date.now()}.${params.extension}`);
  return {
    absolutePath: path.resolve(params.workspaceRoot, relativePath),
    relativePath,
  };
}

function createDefaultOpenAiClient(): OpenAI {
  const config = loadOpenAILiveConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

function parsePreparedUserIoState(
  capabilityKey: TapVendorUserIoCapabilityKey,
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedUserIoState {
  const input = plan.input;
  if (capabilityKey === "request_user_input") {
    const questions = Array.isArray(input.questions) ? input.questions : [];
    if (questions.length === 0) {
      throw new Error("request_user_input requires a non-empty questions array.");
    }
    return {
      capabilityKey,
      payload: {
        questions,
      },
    };
  }

  if (capabilityKey === "request_permissions") {
    const permissions = asRecord(input.permissions);
    if (!permissions || Object.keys(permissions).length === 0) {
      throw new Error("request_permissions requires a non-empty permissions object.");
    }
    return {
      capabilityKey,
      payload: {
        permissions,
        reason: asString(input.reason),
      },
    };
  }

  if (capabilityKey === "audio.transcribe") {
    const candidatePath = asString(input.path);
    if (!candidatePath) {
      throw new Error("audio.transcribe requires a non-empty path.");
    }
    const resolved = resolveInputPath(workspaceRoot, candidatePath);
    return {
      capabilityKey,
      payload: {
        absolutePath: resolved.absolutePath,
        relativePath: resolved.relativePath,
        model: asString(input.model) ?? "gpt-4o-transcribe",
        language: asString(input.language),
        prompt: asString(input.prompt),
        responseFormat: (
          asString(input.responseFormat)
          ?? asString(input.response_format)
          ?? "json"
        ) as AudioTranscriptionResponseFormat,
        include: asStringArray(input.include),
        knownSpeakerNames: asStringArray(input.knownSpeakerNames) ?? asStringArray(input.known_speaker_names),
      },
    };
  }

  if (capabilityKey === "speech.synthesize") {
    const text = asString(input.input) ?? asString(input.text);
    if (!text) {
      throw new Error("speech.synthesize requires non-empty input text.");
    }
    const responseFormat = (
      asString(input.responseFormat)
      ?? asString(input.response_format)
      ?? asString(input.format)
      ?? "mp3"
    ) as "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
    const candidatePath = asString(input.path);
    const resolved = candidatePath
      ? resolveInputPath(workspaceRoot, candidatePath)
      : defaultGeneratedPath({
        workspaceRoot,
        prefix: "speech-synthesize",
        extension: responseFormat,
      });
    return {
      capabilityKey,
      payload: {
        input: text,
        model: asString(input.model) ?? "gpt-4o-mini-tts",
        voice: asString(input.voice) ?? "alloy",
        responseFormat,
        instructions: asString(input.instructions),
        speed: typeof input.speed === "number" ? input.speed : undefined,
        absoluteOutputPath: resolved.absolutePath,
        relativeOutputPath: resolved.relativePath,
      },
    };
  }

  const prompt = asString(input.prompt);
  if (!prompt) {
    throw new Error("image.generate requires a non-empty prompt.");
  }
  const outputFormat = (
    asString(input.outputFormat)
    ?? asString(input.output_format)
    ?? asString(input.format)
    ?? "png"
  ) as "png" | "jpeg" | "webp";
  const candidatePath = asString(input.path);
  const resolved = candidatePath
    ? resolveInputPath(workspaceRoot, candidatePath)
    : defaultGeneratedPath({
      workspaceRoot,
      prefix: "image-generate",
      extension: outputFormat,
    });
  return {
    capabilityKey: "image.generate",
    payload: {
      prompt,
      model: asString(input.model) ?? "gpt-image-1",
      size: asString(input.size),
      quality: asString(input.quality),
      background: asString(input.background),
      outputFormat,
      absoluteOutputPath: resolved.absolutePath,
      relativeOutputPath: resolved.relativePath,
    },
  };
}

export class TapVendorUserIoAdapter implements CapabilityAdapter {
  readonly id: string;
  readonly runtimeKind = "tap-vendor-user-io";
  readonly #capabilityKey: TapVendorUserIoCapabilityKey;
  readonly #workspaceRoot: string;
  readonly #openaiClientFactory: () => OpenAI;
  readonly #preparedStates = new Map<string, PreparedUserIoState>();

  constructor(options: TapVendorUserIoAdapterOptions = {}) {
    this.#capabilityKey = options.capabilityKey ?? "request_user_input";
    this.#workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
    this.#openaiClientFactory = options.openaiClientFactory ?? createDefaultOpenAiClient;
    this.id = `adapter:${this.#capabilityKey}`;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    return plan.capabilityKey === this.#capabilityKey;
  }

  async prepare(
    plan: CapabilityInvocationPlan,
    lease: CapabilityLease,
  ): Promise<PreparedCapabilityCall> {
    const state = parsePreparedUserIoState(this.#capabilityKey, plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      capabilityKey: plan.capabilityKey,
      executionMode: "direct",
      preparedPayloadRef: `tap-vendor-user-io:${stableStringify(state.payload)}`,
      cacheKey: lease.preparedCacheKey ?? stableStringify(state.payload),
      metadata: {
        capabilityKey: this.#capabilityKey,
      },
    });
    this.#preparedStates.set(prepared.preparedId, state);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#preparedStates.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "tap_vendor_user_io_prepared_state_missing",
          message: `Prepared user-io state for ${prepared.preparedId} was not found.`,
        },
        metadata: {
          capabilityKey: this.#capabilityKey,
          runtimeKind: this.runtimeKind,
        },
      });
    }
    this.#preparedStates.delete(prepared.preparedId);

    if (state.capabilityKey === "request_user_input" || state.capabilityKey === "request_permissions") {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "blocked",
        error: {
          code:
            state.capabilityKey === "request_user_input"
              ? "tap_vendor_user_input_required"
              : "tap_vendor_permission_request_required",
          message:
            state.capabilityKey === "request_user_input"
              ? "Operator input is required before this workflow can continue."
              : "Additional operator permissions are required before this workflow can continue.",
          details: state.payload,
        },
        metadata: {
          capabilityKey: state.capabilityKey,
          runtimeKind: this.runtimeKind,
          waitingHuman: true,
        },
      });
    }

    const client = this.#openaiClientFactory();
    if (state.capabilityKey === "audio.transcribe") {
      const response = await client.audio.transcriptions.create({
        file: createReadStream(state.payload.absolutePath),
        model: state.payload.model,
        language: state.payload.language,
        prompt: state.payload.prompt,
        response_format: state.payload.responseFormat,
        include: state.payload.include as never,
        known_speaker_names: state.payload.knownSpeakerNames,
      } as never);
      const text = typeof response === "string"
        ? response
        : typeof response?.text === "string"
          ? response.text
          : "";
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "success",
        output: {
          path: state.payload.relativePath,
          model: state.payload.model,
          responseFormat: state.payload.responseFormat,
          text,
          segments: Array.isArray((response as unknown as { segments?: unknown }).segments)
            ? (response as unknown as { segments: unknown[] }).segments
            : undefined,
          usage: typeof response === "object" && response
            ? (response as { usage?: unknown }).usage
            : undefined,
        },
        metadata: {
          capabilityKey: state.capabilityKey,
          runtimeKind: this.runtimeKind,
        },
      });
    }

    if (state.capabilityKey === "speech.synthesize") {
      const response = await client.audio.speech.create({
        input: state.payload.input,
        model: state.payload.model,
        voice: state.payload.voice,
        instructions: state.payload.instructions,
        response_format: state.payload.responseFormat,
        speed: state.payload.speed,
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      await mkdir(path.dirname(state.payload.absoluteOutputPath), { recursive: true });
      await writeFile(state.payload.absoluteOutputPath, bytes);
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "success",
        output: {
          path: state.payload.relativeOutputPath,
          model: state.payload.model,
          voice: state.payload.voice,
          responseFormat: state.payload.responseFormat,
          bytesWritten: bytes.byteLength,
        },
        metadata: {
          capabilityKey: state.capabilityKey,
          runtimeKind: this.runtimeKind,
        },
      });
    }

    const response = await client.images.generate({
      model: state.payload.model,
      prompt: state.payload.prompt,
      size: state.payload.size as never,
      quality: state.payload.quality as never,
      background: state.payload.background as never,
      output_format: state.payload.outputFormat,
    });
    const image = Array.isArray(response.data) ? response.data[0] : undefined;
    const b64 = typeof image?.b64_json === "string" ? image.b64_json : undefined;
    if (!b64) {
      throw new Error("image.generate did not return b64_json data.");
    }
    const bytes = Buffer.from(b64, "base64");
    await mkdir(path.dirname(state.payload.absoluteOutputPath), { recursive: true });
    await writeFile(state.payload.absoluteOutputPath, bytes);
    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        path: state.payload.relativeOutputPath,
        model: state.payload.model,
        size: state.payload.size ?? response.size ?? null,
        quality: state.payload.quality ?? response.quality ?? null,
        outputFormat: state.payload.outputFormat,
        revisedPrompt: image?.revised_prompt,
        bytesWritten: bytes.byteLength,
      },
      metadata: {
        capabilityKey: state.capabilityKey,
        runtimeKind: this.runtimeKind,
      },
    });
  }

  async healthCheck() {
    return {
      status: "healthy",
      adapterId: this.id,
      runtimeKind: this.runtimeKind,
      capabilityKey: this.#capabilityKey,
    };
  }
}

export function createTapVendorUserIoAdapter(
  options: TapVendorUserIoAdapterOptions = {},
): TapVendorUserIoAdapter {
  return new TapVendorUserIoAdapter(options);
}

export function createTapVendorUserIoActivationFactory(
  options: TapVendorUserIoAdapterOptions = {},
): ActivationAdapterFactory {
  return (context) =>
    createTapVendorUserIoAdapter({
      ...options,
      capabilityKey:
        TAP_VENDOR_USER_IO_CAPABILITY_KEYS.includes(
          context.manifest?.capabilityKey as TapVendorUserIoCapabilityKey,
        )
          ? (context.manifest?.capabilityKey as TapVendorUserIoCapabilityKey)
          : options.capabilityKey,
    });
}

export function registerTapVendorUserIoFamily(
  input: RegisterTapVendorUserIoFamilyInput,
): RegisterTapVendorUserIoFamilyResult {
  const capabilityKeys = (input.capabilityKeys ?? TAP_VENDOR_USER_IO_CAPABILITY_KEYS) as
    readonly TapVendorUserIoCapabilityKey[];

  const manifests: CapabilityManifest[] = [];
  const packages: CapabilityPackage[] = [];
  const bindings: unknown[] = [];
  const activationFactoryRefs: string[] = [];

  for (const capabilityKey of capabilityKeys) {
    const capabilityPackage = createTapVendorUserIoCapabilityPackage({
      capabilityKey,
      replayPolicy: input.replayPolicy,
    });
    const manifest = createCapabilityManifestFromPackage(capabilityPackage);
    const activationFactoryRef =
      TAP_VENDOR_USER_IO_ACTIVATION_FACTORY_REFS[capabilityKey];
    const factory = createTapVendorUserIoActivationFactory({ capabilityKey });

    input.runtime.registerTaActivationFactory(activationFactoryRef, factory);
    const adapter = factory({
      capabilityPackage,
      activationSpec: capabilityPackage.activationSpec!,
      bindingPayload: capabilityPackage.activationSpec?.bindingPayload,
      manifest,
      manifestPayload: capabilityPackage.activationSpec?.manifestPayload,
      metadata: {
        registrationSource: "registerTapVendorUserIoFamily",
      },
    });
    const binding = input.runtime.registerCapabilityAdapter(manifest, adapter);

    manifests.push(manifest);
    packages.push(capabilityPackage);
    bindings.push(binding);
    activationFactoryRefs.push(activationFactoryRef);
  }

  return {
    capabilityKeys: [...capabilityKeys],
    activationFactoryRefs,
    manifests,
    packages,
    bindings,
  };
}
