// Gemini Agent SDK call surface.
//
// This folder is for Google ADK / agent-runtime concerns, not raw Gemini API
// endpoint wrappers.
//
// Current layout:
// - runtime/
// - orchestration/
// - tooling/
// - state/
// - governance/
// - observability/
// - extensions/
// - deployment/
//
// Suggested usage:
// - runtime: agent definitions such as LlmAgent/workflow agents
// - orchestration: transfer, agent-as-tool, multi-agent flow control
// - tooling: function tools, Gemini built-ins, MCP consumption/exposure
// - state: sessions, memory, artifacts
// - observability: callbacks and evaluation hooks
// - deployment: local server, UI, Agent Engine related adapters
