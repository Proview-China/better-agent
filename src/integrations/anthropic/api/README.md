// Anthropic API SDK call surface.
//
// This folder is only for direct Anthropic platform capabilities.
// Many tool-like abilities appear at the API layer, but the full runtime loop
// still belongs under `../agent`.
//
// Current layout:
// - generation/
// - modalities/
// - tools/
// - resources/
// - operations/
//
// Suggested usage:
// - generation: Messages API, streaming, thinking, structured output
// - modalities: embeddings, vision/PDF-related payload semantics
// - tools: tool use, server tools, MCP connector, search/code/bash/computer-use
// - resources: files, models, skills beta
// - operations: batches, token counting, other async/admin-like API flows
//
// Thin capability leaf modules currently planned:
// - generation/messages: `generate.create`, `generate.stream`
// - resources/files: `file.upload` via beta files API
// - operations/batches: `batch.submit` via beta message batches
// - modalities/embeddings: explicit unsupported metadata only
