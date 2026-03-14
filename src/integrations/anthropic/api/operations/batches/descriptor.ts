import type Anthropic from "@anthropic-ai/sdk";
import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation
} from "../../../../../rax/contracts.js";
import type {
  AnthropicBatchRequestInput,
  AnthropicBatchSubmitInput
} from "../../shared.js";

const ANTHROPIC_BATCHES_SDK = {
  packageName: "@anthropic-ai/sdk",
  entrypoint: "client.beta.messages.batches.create",
  notes: "Anthropic batch submission currently routes through beta message batches."
} as const;

function lowerBatchRequest(
  model: string,
  request: AnthropicBatchRequestInput
): Anthropic.Beta.Messages.BatchCreateParams.Request {
  return {
    custom_id: request.customId,
    params: {
      model,
      max_tokens: request.maxTokens,
      messages: request.messages,
      system: request.system,
      metadata: request.metadata,
      stop_sequences: request.stopSequences,
      temperature: request.temperature,
      top_k: request.topK,
      top_p: request.topP,
      tools: request.tools,
      tool_choice: request.toolChoice
    }
  };
}

export const anthropicBatchSubmitDescriptor = {
  id: "anthropic.api.operations.batches.submit",
  key: "batch.submit",
  namespace: "batch",
  action: "submit",
  provider: "anthropic",
  layer: "api",
  description: "Lower a unified batch submit request to Anthropic beta message batches.create.",
  prepare(request) {
    return {
      key: "batch.submit",
      provider: "anthropic",
      model: request.model,
      layer: "api",
      adapterId: "anthropic.api.operations.batches.submit",
      sdk: ANTHROPIC_BATCHES_SDK,
      payload: {
        requests: request.input.requests.map((entry) => lowerBatchRequest(request.model, entry)),
        betas: request.input.betas
      }
    } satisfies PreparedInvocation<Anthropic.Beta.Messages.BatchCreateParams>;
  }
} satisfies CapabilityAdapterDescriptor<
  AnthropicBatchSubmitInput,
  Anthropic.Beta.Messages.BatchCreateParams
>;
