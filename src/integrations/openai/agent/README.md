// OpenAI Agent SDK call surface.
//
// This folder is for OpenAI agent-runtime concerns, not raw API endpoints.
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
// Expected concerns:
// - runtime: agent definitions and loop ownership
// - orchestration: handoffs, agents-as-tools, multi-agent routing
// - tooling: hosted tools, function tools, MCP wiring
// - state: sessions, memory handoff, context persistence
// - governance: guardrails, approvals, human-in-the-loop
// - observability: tracing and runtime evidence
// - extensions: reusable presets/helpers
// - deployment: realtime agents or packaging-specific entrypoints
