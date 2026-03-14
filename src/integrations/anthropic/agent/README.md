// Anthropic Agent SDK call surface.
//
// This folder is for Claude Agent SDK / Claude Code runtime concerns, not raw
// Messages API calls.
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
// - orchestration: subagents and task transfer
// - tooling: MCP servers, built-in tools, SDK-exposed tool adapters
// - state: resume/fork sessions and runtime memory handoff
// - governance: canUseTool, ask-user flows, approval hooks
// - extensions: hooks, commands, skills, plugins
