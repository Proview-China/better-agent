// Gemini API SDK call surface.
//
// This folder is only for direct Gemini platform capabilities.
// It covers SDK-facing API features such as generateContent, interactions,
// built-in tools, multimodal resources, and batch/live endpoints.
//
// Current layout:
// - generation/
// - modalities/
// - tools/
// - resources/
// - operations/
//
// Suggested usage:
// - generation: generateContent, interactions, live
// - modalities: embeddings and multimodal request/response contracts
// - tools: Google Search, Maps, URL Context, code execution, computer use, MCP
// - resources: files, caches, model registry-like metadata
// - operations: batch and other async flows
//
// Thin-capability leaf modules currently wired for router consumption:
// - generation/generate_content/create.ts -> `generate.create`
// - generation/generate_content/stream.ts -> `generate.stream`
// - modalities/embeddings/create.ts -> `embed.create`
// - resources/files/upload.ts -> `file.upload`
// - operations/batches/submit.ts -> `batch.submit`
//
// Each leaf exports a `CapabilityAdapterDescriptor`-compatible descriptor and a
// `prepare()` function that lowers the unified request into Gemini SDK method
// calls such as `ai.models.generateContent(...)` or `ai.files.upload(...)`.
