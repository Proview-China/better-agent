# Praxis Support Matrix

This document records the current support baseline for exported Praxis surfaces.

## Platform Baseline

- macOS local baseline: primary validated host profile
- Linux current state: compile-safe placeholder or degraded host truth unless stated otherwise

## RuntimeKit Surface Matrix

| Surface | macOS local baseline | Linux current state | Notes |
| --- | --- | --- | --- |
| `PraxisRuntimeClient.makeDefault(...)` | ready | compile-safe placeholder baseline | Both sides can assemble RuntimeKit; Linux remains a placeholder host profile. |
| `runs.run(...)` / `runs.resume(...)` | ready | ready | Run lifecycle depends on local SQLite and in-process runtime truth. |
| `capabilities.catalog()` | ready | ready | Thin capability baseline includes search chain, `code.sandbox`, provider `skill.list` / `skill.activate`, and bounded `code.run` / `code.patch` / `shell.approve` / `shell.run`. |
| `capabilities.generate(...)` / `stream(...)` | ready | ready | Uses the local provider inference lane; `stream` is projected bounded output, not raw token transport. |
| `capabilities.embed(...)` | ready | ready | Uses the local embedding baseline. |
| `capabilities.describeCodeSandbox(...)` | declared-only contract | placeholder contract | macOS exposes structured writable/readable roots and enforcement mode; it does not yet claim kernel-enforced isolation. |
| `capabilities.patchCode(...)` | ready | unavailable | macOS uses the bounded workspace patch lane; Linux currently does not expose this capability. |
| `capabilities.runCode(...)` | ready | placeholder-backed bounded seam | macOS executes bounded Swift snippets; Linux returns placeholder `failedToLaunch` semantics while preserving bounded result shape. |
| `capabilities.requestShellApproval(...)` / `readbackShellApproval(...)` | ready | ready | Durable CMP/TAP approval path for bounded shell execution. |
| `capabilities.runShell(...)` | ready | placeholder-backed bounded seam | macOS uses real local shell execution; Linux returns placeholder `failedToLaunch` semantics. |
| `capabilities.listSkills(...)` / `activateSkill(...)` | ready | ready | Provider skill activation only accepts registered skill keys and only audits successful activations. |
| `capabilities.listProviderMCPTools(...)` | ready | ready | Provider MCP registry exposes callable tool names for discovery/readback. |
| `capabilities.callTool(...)` / `uploadFile(...)` / `submitBatch(...)` | ready | ready | Uses local MCP, file store, and batch baseline; `tool.call` only accepts registered tool names and only audits successful executions. |
| `capabilities.openSession(...)` | ready | ready | Provides caller-scoped runtime session headers. |
| `capabilities.searchWeb(...)` / `fetchSearchResult(...)` / `groundSearchResult(...)` | ready | placeholder-backed SDK seam | macOS uses local deterministic baseline; Linux still lacks a real browser / search substrate. |
| `tap.inspect()` | ready | ready with degraded host summaries | Exposes reviewer backlog, latest decision, section summaries, provider discovery, and recovery hints. |
| `tap.project(...).overview(...)` | ready | ready | Capability visibility still depends on host wiring truth. |
| `tap.project(...).reviewWorkbench(...)` | ready | ready with degraded host summaries | Aggregates inspection, TAP history, CMP overview, reviewer queue, and provider activity. |
| `cmp.project(...).overview(...)` / `approvalOverview(...)` | ready | ready with degraded host summaries | Linux still degrades git / shell / process truth. |
| `cmp.project(...).smoke()` | ready | degraded | Smoke reports degraded host readiness honestly. |
| `mp.project(...).overview(...)` / `search(...)` / `resolve(...)` / `history(...)` | ready | ready | Uses local semantic memory and heuristic baseline. |
| `mp.project(...).smoke()` | ready | ready | Host-neutral smoke surface. |
| system shell / system git / process supervision | macOS-only baseline | placeholder only | Linux implementation remains explicitly postponed. |
| `PraxisRuntimeKitSmoke` | ready | compile-safe, expected degraded host checks | Smoke harness is a verification product, not a fully backed cross-platform runtime claim. |

## Export Surface Matrix

| Surface | Current status | Notes |
| --- | --- | --- |
| `PraxisRuntimeKit` | recommended | Primary Swift integration surface. |
| `PraxisRuntimeInterface` | ready | Encoded host-neutral request / response surface with explicit schema versions. |
| `PraxisFFI` | ready | Minimal encoded bridge over runtime interface registry and opaque handles. |
| `PraxisFFIEmbeddingExample` | ready | Smallest bridge-level embedding path. |
| `PraxisAppleHostEmbeddingExample` | ready | Host-like Apple-side embedding path with architecture negotiation first. |

## Verification Baseline

Recommended checks for the current exported surface:

```bash
swift test
swift run PraxisFFIEmbeddingExample
swift run PraxisAppleHostEmbeddingExample
swift run PraxisRuntimeKitSmoke --suite all
```
