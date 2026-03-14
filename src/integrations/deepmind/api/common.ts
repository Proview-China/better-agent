import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation
} from "../../../rax/contracts.js";
import type {
  CapabilityKey,
  CapabilityRequest,
  CapabilityAction
} from "../../../rax/types.js";

export interface GeminiPreparedPayload<TParams = unknown> {
  method: string;
  clientOptions?: Record<string, unknown>;
  params: TParams;
  notes?: string[];
}

export interface GeminiModelCallInput {
  contents: unknown;
  config?: Record<string, unknown>;
}

export interface GeminiFileUploadInput {
  file: string | Blob;
  config?: Record<string, unknown>;
}

export interface GeminiBatchSubmitInput {
  src: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface GeminiModelCallParams {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
}

export interface GeminiFileUploadParams {
  file: string | Blob;
  config?: Record<string, unknown>;
}

export interface GeminiBatchSubmitParams {
  model: string;
  src: Record<string, unknown>;
  config?: Record<string, unknown>;
}

const GEMINI_SDK_SURFACE = {
  packageName: "@google/genai",
  entrypoint: "GoogleGenAI",
  notes: "Initialize via new GoogleGenAI({ apiKey }) or Vertex options before calling the prepared method."
} as const;

function getDeepMindClientOptions(
  request: CapabilityRequest<unknown>
): Record<string, unknown> | undefined {
  return request.providerOptions?.deepmind;
}

export function buildGeminiPreparedInvocation<TInput, TParams>(
  descriptor: CapabilityAdapterDescriptor<TInput, GeminiPreparedPayload<TParams>>,
  request: CapabilityRequest<TInput>,
  method: string,
  params: TParams,
  notes?: string[]
): PreparedInvocation<GeminiPreparedPayload<TParams>> {
  return {
    key: descriptor.key,
    provider: "deepmind",
    model: request.model,
    layer: descriptor.layer,
    adapterId: descriptor.id,
    sdk: GEMINI_SDK_SURFACE,
    payload: {
      method,
      clientOptions: getDeepMindClientOptions(request),
      params,
      notes
    }
  };
}

export function assertAction(
  request: CapabilityRequest<unknown>,
  expected: CapabilityAction
): void {
  if (request.action !== expected) {
    throw new Error(
      `Expected action ${expected} for ${request.capability}, received ${request.action}.`
    );
  }
}

export function buildCapabilityKey(namespace: string, action: string): CapabilityKey {
  return `${namespace}.${action}` as CapabilityKey;
}
