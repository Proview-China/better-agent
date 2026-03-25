# CMP Runtime Live Integration Part 4 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 4 负责收五个 agent 开工前的 final integration gates。

这里要做的不是五个 agent 本体，而是：

- 明确什么时候可以开始做它们
- 哪些联调和回读证据必须先具备

## 推荐文件列表

- `00-final-gate-protocol-freeze.md`
- `01-entry-and-lowering-preflight.md`
- `02-shared-infra-observability-surface.md`
- `03-end-to-end-smoke-matrix.md`
- `04-recovery-and-interruption-runbook.md`
- `05-five-agent-readiness-contract.md`
- `06-stage-wrap-up-and-handoff.md`
- `07-final-acceptance-gates.md`
- `08-next-stage-launchpad.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`

### Wave 2

- `03`
- `04`

### Wave 3

- `05`
- `06`

### Wave 4

- `07`
- `08`

## 二层 agent 角色

### `Part4 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `07`

### `Observability And Smoke Worker`

- 模型：`gpt-5.4-medium`
- ownership：
  - `02`
  - `03`

### `Recovery And Readiness Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `04`
  - `05`

### `Handoff Worker`

- 模型：`gpt-5.4-medium`
- ownership：
  - `06`
  - `08`

## 强依赖提醒

- Part 1/2/3 没稳前，Part 4 不能提前宣布进入五个 agent 阶段。
- `05` 只写 readiness contract，不写五个 agent 全实现。
- `07` 和 `08` 必须最后收。

## 最小验收口径

- five-agent readiness contract 明确。
- 端到端 smoke、observability、recovery、runbook 都具备最小闭环。
- 下一阶段启动条件已写清，不再靠口头记忆。
