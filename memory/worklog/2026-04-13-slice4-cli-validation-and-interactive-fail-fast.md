# 2026-04-13 Slice 4: CLI validation and interactive fail-fast

## Summary

- Kept `PraxisCLI` as a narrow verification entrypoint over `PraxisRuntimeGateway -> PraxisRuntimeInterface`.
- Changed `interactive` from a silent no-op into an explicit fail-fast configuration error.
- Tightened parser validation so `run-goal` only rejects pure unsupported `--flag` placeholders while preserving freeform summary text, and `resume-run` accepts exactly one strict positional run ID while continuing to reject unsupported `--flag` inputs.

## Files

- `Sources/PraxisCLI/PraxisCLIModels.swift`
- `Sources/PraxisCLI/PraxisCLIControllers.swift`
- `Tests/PraxisCLITests/PraxisCLITests.swift`

## Validation

- Added parser regression coverage for `run-goal` freeform summaries, `resume-run` strict single-argument parsing, and `run-goal` / `resume-run` flag rejection.
- Added end-to-end CLI app coverage for:
  - unknown commands
  - invalid flags on `run-goal` / `resume-run`
  - extra positional rejection on `resume-run`
  - unsupported interactive mode
- All new cases assert stable `PraxisCLIError` user-facing messages and verify the runtime interface is not invoked on preflight failures.

## Notes

- This slice does not add commands or interactive session behavior.
- `PraxisInteractiveSessionController` remains non-integrated by design; the active contract is explicit non-interactive CLI usage only.
