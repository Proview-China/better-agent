// Provider integration scaffold for model-specific SDK work.
//
// Top-level rule:
// - `api/` is the direct platform-client layer.
// - `agent/` is the runtime/orchestration layer.
//
// Shared layering rule:
// - API side prefers capability/resource grouping:
//   generation, modalities, tools, resources, operations.
// - Agent side prefers runtime-management grouping:
//   runtime, orchestration, tooling, state, governance,
//   observability, extensions, deployment.
//
// Provider-specific leaf modules can diverge, but these management levels
// should remain stable so later Codex runs know where each concern belongs.
