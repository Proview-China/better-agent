import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  assertAction,
  buildGeminiPreparedInvocation,
  type GeminiBatchSubmitInput,
  type GeminiBatchSubmitParams,
  type GeminiPreparedPayload
} from "../../common.js";

export interface DeepMindBatchSubmitInput extends GeminiBatchSubmitInput {}

export const deepMindBatchSubmitDescriptor: CapabilityAdapterDescriptor<
  DeepMindBatchSubmitInput,
  GeminiPreparedPayload<GeminiBatchSubmitParams>
> = {
  id: "deepmind.api.batch.submit.batches-create",
  key: "batch.submit",
  namespace: "batch",
  action: "submit",
  provider: "deepmind",
  layer: "api",
  description: "Lower a unified batch.submit request to ai.batches.create().",
  prepare(
    request: CapabilityRequest<DeepMindBatchSubmitInput>
  ) {
    assertAction(request, "submit");

    return buildGeminiPreparedInvocation(
      deepMindBatchSubmitDescriptor,
      request,
      "ai.batches.create",
      {
        model: request.model,
        src: request.input.src,
        config: request.input.config
      },
      [
        "Gemini batch submission maps to ai.batches.create({ model, src, config }).",
        "Embedding batch jobs are intentionally out of scope for this thin capability adapter."
      ]
    );
  }
};
