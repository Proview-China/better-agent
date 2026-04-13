# 2026-04-13 Swift Refactor Plan Refresh

## What Changed

- Refreshed `SWIFT_REFACTOR_PLAN.md` so its current-state sections no longer describe the repository as if it were still at the `2026-04-11 / 150 tests / 39 suites` checkpoint.
- Updated the validation snapshot to the current local baseline:
  - `swift test`: `355 tests / 53 suites`
  - `npm run typecheck`: still failing at `src/agent_core/live-agent-chat.ts:1690`
- Rewrote the `current Swift state` and `Wave 6: HostRuntime` sections to match the current code and recent work packages:
  - CMP `session / project / flow / roles / control / readback` is no longer described as an unpromoted major gap
  - MP workflow / readback / smoke hardening is reflected as completed current-state work rather than an open architecture idea
  - `localDefaults(rootDirectory:)` now distinguishes real local runtime lanes from host-facing lanes that must be described by provenance truth
- Replaced stale blanket wording about provider/browser/user-io with the current provenance model:
  - `unavailable`
  - `scaffoldPlaceholder`
  - `localBaseline`
  - `composed`
- Compressed the residual list so it only keeps credible remaining work:
  - schema versioning / migration policy
  - deeper live host depth for provider/browser/multimodal lanes
  - more provenance / mixed-fallback regression coverage
  - formal `PraxisFFI` target work
  - optional TS UI typecheck tail

## Why This Refresh Was Needed

- `SWIFT_REFACTOR_PLAN.md` is the only root-level Swift plan entry point in this repository.
- After the recent HostRuntime, MP, provenance-truth, and CMP/TAP readback wording packages, the old plan had become materially misleading:
  - it understated current test coverage
  - it overstated some already-closed HostRuntime gaps
  - it still described `localDefaults` with a pre-provenance truth model
- Refreshing the plan now keeps the root plan aligned with the real code and avoids forcing future work to navigate around stale status notes.

## Files Touched

- `SWIFT_REFACTOR_PLAN.md`
- `memory/worklog/2026-04-13-swift-refactor-plan-refresh.md`

## Validation

- Read back `SWIFT_REFACTOR_PLAN.md` against the current worktree and recent `2026-04-13` worklogs
- Ran `swift test`
- Ran `npm run typecheck`

## Residual Notes

- This package only refreshes planning truth. It does not change Swift or TypeScript implementation.
- The plan is now aligned to the current non-UI Swift mainline, but it still intentionally avoids claiming TS feature parity or completed export/runtime-live depth.
