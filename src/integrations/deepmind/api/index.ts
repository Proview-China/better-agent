import type { CapabilityAdapterDescriptor } from "../../../rax/contracts.js";
import { deepMindGenerateCreateDescriptor } from "./generation/generate_content/create.js";
import { deepMindGenerateStreamDescriptor } from "./generation/generate_content/stream.js";
import { deepMindEmbedCreateDescriptor } from "./modalities/embeddings/create.js";
import { deepMindBatchSubmitDescriptor } from "./operations/batches/submit.js";
import { deepMindFileUploadDescriptor } from "./resources/files/upload.js";
import { deepMindSearchGroundDescriptor } from "./tools/search/ground.js";

export {
  deepMindBatchSubmitDescriptor,
  deepMindEmbedCreateDescriptor,
  deepMindFileUploadDescriptor,
  deepMindGenerateCreateDescriptor,
  deepMindGenerateStreamDescriptor,
  deepMindSearchGroundDescriptor
};

export const deepMindApiCapabilityDescriptors: readonly CapabilityAdapterDescriptor[] = [
  deepMindGenerateCreateDescriptor,
  deepMindGenerateStreamDescriptor,
  deepMindEmbedCreateDescriptor,
  deepMindFileUploadDescriptor,
  deepMindBatchSubmitDescriptor,
  deepMindSearchGroundDescriptor
];
