import type { CapabilityRequest } from "../../../../../rax/index.js";

import type {
  OpenAIApiAdapterDescriptor,
  OpenAIFileUploadInput,
} from "../../types.js";

import { omitUndefined, prepareOpenAIInvocation } from "../../types.js";

export const openAIFilesUploadDescriptor: OpenAIApiAdapterDescriptor<
  OpenAIFileUploadInput,
  {
    file: OpenAIFileUploadInput["file"];
    purpose: OpenAIFileUploadInput["purpose"];
    expires_after?: OpenAIFileUploadInput["expiresAfter"];
  }
> = {
  id: "openai.files.upload",
  key: "file.upload",
  namespace: "file",
  action: "upload",
  provider: "openai",
  layer: "api",
  description:
    "Lower a unified file.upload request into OpenAI files.create params.",
  prepare(request: CapabilityRequest<OpenAIFileUploadInput>) {
    const input = request.input;

    return prepareOpenAIInvocation(openAIFilesUploadDescriptor, request, {
      surface: "files",
      sdkMethodPath: "client.files.create",
      params: omitUndefined({
        file: input.file,
        purpose: input.purpose,
        expires_after: input.expiresAfter,
      }),
      notes: [
        "OpenAI file upload purpose selection is significant for downstream APIs such as batches and fine-tuning.",
      ],
    });
  },
};
