import type { CapabilityRequest } from "../../../../../rax/index.js";

import type {
  OpenAIApiAdapterDescriptor,
  OpenAIBatchSubmitInput,
} from "../../types.js";

import { omitUndefined, prepareOpenAIInvocation } from "../../types.js";

export const openAIBatchesSubmitDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIBatchSubmitInput,
  {
    completion_window: "24h";
    endpoint: OpenAIBatchSubmitInput["endpoint"];
    input_file_id: string;
    metadata?: OpenAIBatchSubmitInput["metadata"];
    output_expires_after?: OpenAIBatchSubmitInput["outputExpiresAfter"];
  }
> = {
  id: "openai.batches.submit",
  key: "batch.submit",
  namespace: "batch",
  action: "submit",
  provider: "openai",
  layer: "api",
  description:
    "Lower a unified batch.submit request into OpenAI batches.create params.",
  prepare(request: CapabilityRequest<OpenAIBatchSubmitInput>) {
    const input = request.input;

    return prepareOpenAIInvocation(openAIBatchesSubmitDescriptor, request, {
      surface: "batches",
      sdkMethodPath: "client.batches.create",
      params: omitUndefined({
        completion_window: input.completionWindow ?? "24h",
        endpoint: input.endpoint,
        input_file_id: input.inputFileId,
        metadata: input.metadata,
        output_expires_after: input.outputExpiresAfter,
      }),
      notes: [
        "OpenAI batches currently require an uploaded JSONL file and a supported endpoint path.",
      ],
    });
  },
};
