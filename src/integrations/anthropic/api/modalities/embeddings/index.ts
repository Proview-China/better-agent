import type { UnsupportedCapabilityNotice } from "../../shared.js";

export const anthropicEmbeddingsUnsupportedNotice: UnsupportedCapabilityNotice = {
  key: "embed.create",
  provider: "anthropic",
  layer: "api",
  supported: false,
  notes:
    "Anthropic does not currently provide a native embeddings model via its own API SDK baseline; use a third-party embeddings provider instead."
};
