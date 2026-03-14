// OpenAI API SDK call surface.
//
// This folder is only for direct OpenAI platform capabilities.
// It intentionally excludes agent-runtime concerns such as handoffs,
// guardrails, sessions, or tracing orchestration.
//
// Current layout:
// - generation/
//   - responses/
//   - chat_completions_compat/
//   - realtime/
// - modalities/
//   - embeddings/
//   - images/
//   - audio/
//   - moderations/
// - resources/
//   - files/
//   - uploads/
//   - vector_stores/
//   - models/
// - operations/
//   - batches/
//   - fine_tuning/
//
// Put endpoint contracts, request/response mapping notes, and provider-specific
// adapters here.
