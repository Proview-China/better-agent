import type { CapabilityAdapterDescriptor } from "../../../../../rax/contracts.js";
import type { CapabilityRequest } from "../../../../../rax/types.js";
import {
  assertAction,
  buildGeminiPreparedInvocation,
  type GeminiFileUploadInput,
  type GeminiFileUploadParams,
  type GeminiPreparedPayload
} from "../../common.js";

export interface DeepMindFileUploadInput extends GeminiFileUploadInput {}

export const deepMindFileUploadDescriptor: CapabilityAdapterDescriptor<
  DeepMindFileUploadInput,
  GeminiPreparedPayload<GeminiFileUploadParams>
> = {
  id: "deepmind.api.file.upload.files-upload",
  key: "file.upload",
  namespace: "file",
  action: "upload",
  provider: "deepmind",
  layer: "api",
  description: "Lower a unified file.upload request to ai.files.upload().",
  prepare(
    request: CapabilityRequest<DeepMindFileUploadInput>
  ) {
    assertAction(request, "upload");

    return buildGeminiPreparedInvocation(
      deepMindFileUploadDescriptor,
      request,
      "ai.files.upload",
      {
        file: request.input.file,
        config: request.input.config
      },
      [
        "Gemini file upload uses ai.files.upload({ file, config }).",
        "This adapter does not force a model into the file upload payload."
      ]
    );
  }
};
