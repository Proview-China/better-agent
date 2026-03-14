import type { FacadeCallOptions, PreparedInvocation } from "./contracts.js";
import { applyCompatibilityProfile, type CompatibilityProfile } from "./compatibility.js";
import { createCapabilityRequest, type CapabilityRouter } from "./router.js";

export interface RaxFacade {
  generate: {
    create<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
    stream<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  embed: {
    create<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  file: {
    upload<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
  batch: {
    submit<TInput = unknown, TPayload = unknown>(
      options: FacadeCallOptions<TInput>
    ): PreparedInvocation<TPayload>;
  };
}

export function createRaxFacade(router: CapabilityRouter): RaxFacade {
  return createConfiguredRaxFacade(router);
}

export function createConfiguredRaxFacade(
  router: CapabilityRouter,
  profiles?: readonly CompatibilityProfile[]
): RaxFacade {
  function prepare<TInput = unknown, TPayload = unknown>(
    capability: "generate" | "embed" | "file" | "batch",
    action: "create" | "stream" | "upload" | "submit",
    options: FacadeCallOptions<TInput>
  ): PreparedInvocation<TPayload> {
    const request = createCapabilityRequest(capability, action, options);
    const normalized = profiles
      ? applyCompatibilityProfile(request, profiles)
      : request;
    return router.prepare(normalized);
  }

  return {
    generate: {
      create: (options) => {
        return prepare("generate", "create", options);
      },
      stream: (options) => {
        return prepare("generate", "stream", options);
      }
    },
    embed: {
      create: (options) => {
        return prepare("embed", "create", options);
      }
    },
    file: {
      upload: (options) => {
        return prepare("file", "upload", options);
      }
    },
    batch: {
      submit: (options) => {
        return prepare("batch", "submit", options);
      }
    }
  };
}
