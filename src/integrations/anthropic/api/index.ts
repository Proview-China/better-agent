export {
  anthropicGenerateCreateDescriptor,
  anthropicGenerateStreamDescriptor
} from "./generation/messages/index.js";
export { anthropicEmbeddingsUnsupportedNotice } from "./modalities/embeddings/index.js";
export { anthropicBatchSubmitDescriptor } from "./operations/batches/index.js";
export { anthropicFileUploadDescriptor } from "./resources/files/index.js";
export { anthropicSearchGroundDescriptor } from "./tools/search/index.js";

import {
  anthropicGenerateCreateDescriptor,
  anthropicGenerateStreamDescriptor
} from "./generation/messages/index.js";
import { anthropicBatchSubmitDescriptor } from "./operations/batches/index.js";
import { anthropicFileUploadDescriptor } from "./resources/files/index.js";
import { anthropicSearchGroundDescriptor } from "./tools/search/index.js";

export const ANTHROPIC_API_ADAPTERS = [
  anthropicGenerateCreateDescriptor,
  anthropicGenerateStreamDescriptor,
  anthropicFileUploadDescriptor,
  anthropicBatchSubmitDescriptor,
  anthropicSearchGroundDescriptor
] as const;
