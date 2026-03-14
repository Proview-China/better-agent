import type Anthropic from "@anthropic-ai/sdk";
import type {
  CapabilityAdapterDescriptor,
  PreparedInvocation
} from "../../../../../rax/contracts.js";
import type { AnthropicFileUploadInput } from "../../shared.js";

const ANTHROPIC_FILES_SDK = {
  packageName: "@anthropic-ai/sdk",
  entrypoint: "client.beta.files.upload",
  notes: "Anthropic file uploads are currently surfaced from the beta files resource."
} as const;

export const anthropicFileUploadDescriptor = {
  id: "anthropic.api.resources.files.upload",
  key: "file.upload",
  namespace: "file",
  action: "upload",
  provider: "anthropic",
  layer: "api",
  description: "Lower a unified file upload request to Anthropic beta files.upload.",
  prepare(request) {
    return {
      key: "file.upload",
      provider: "anthropic",
      model: request.model,
      layer: "api",
      adapterId: "anthropic.api.resources.files.upload",
      sdk: ANTHROPIC_FILES_SDK,
      payload: {
        file: request.input.file,
        betas: request.input.betas
      }
    } satisfies PreparedInvocation<Anthropic.Beta.Files.FileUploadParams>;
  }
} satisfies CapabilityAdapterDescriptor<
  AnthropicFileUploadInput,
  Anthropic.Beta.Files.FileUploadParams
>;
