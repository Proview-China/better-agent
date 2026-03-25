# CMP Infra Closure Part 4 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 4 负责收最后的 preflight、observability、smoke、multi-agent gate，以及五个 agent 真正接入前的 final infra gate。

## 推荐文件列表

- `00-final-gate-protocol-freeze.md`
- `01-bootstrap-preflight-checklist.md`
- `02-readback-observability-and-debug-surface.md`
- `03-recovery-preflight-and-ops-runbook.md`
- `04-multi-agent-neighborhood-gates.md`
- `05-five-agent-preflight-contract.md`
- `06-system-smoke-matrix.md`
- `07-final-readback-and-acceptance-gates.md`
- `08-handoff-for-five-agent-implementation.md`
- `09-stage-wrap-up-and-closure-readback.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`

### Wave 2

- `02`

### Wave 3

- `03`
- `04`

### Wave 4

- `05`
- `06`

### Wave 5

- `07`
- `08`

### Wave 6

- `09`

## 二层 agent 角色

### `Part4 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `07`
  - `09`

### `Observability Worker`

- 模型：`gpt-5.4-medium`
- ownership：
  - `02`
  - `06`

### `Gate And Preflight Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `03`
  - `05`

### `Handoff Worker`

- 模型：`gpt-5.4-medium`
- ownership：
  - `04`
  - `08`

## 强依赖提醒

- Part 1/2/3 没收稳前，Part 4 不要提前宣告 close。
- `05` 虽然提到五个 agent，但这里只写 preflight，不写 agent 全实现。
- `09` 必须最后收。

## 最小验收口径

- preflight checklist 明确。
- observability/debug/readback surface 明确。
- five-agent 接入前的 final infra gate 明确。
- 整个 `CMP infra closure` 有阶段性 wrap-up 文档。
