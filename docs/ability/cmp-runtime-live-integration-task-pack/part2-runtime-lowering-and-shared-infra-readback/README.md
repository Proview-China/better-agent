# CMP Runtime Live Integration Part 2 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 2 负责把 `cmp-runtime` 的关键动作继续 lower 到 shared infra，并补齐 readback / recovery / smoke 的真实证据。

一句白话：

- 这包处理的是“从 runtime 样板”走向“真实 shared infra 主链”

## 推荐文件列表

- `00-lowering-protocol-freeze.md`
- `01-commit-to-real-git-refs.md`
- `02-checked-snapshot-and-promotion-readback.md`
- `03-db-projection-package-delivery-writeback.md`
- `04-redis-publish-ack-readback.md`
- `05-request-history-on-real-readback.md`
- `06-checkpoint-recovery-with-infra-state.md`
- `07-live-smoke-and-fixture-matrix.md`

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

## 二层 agent 角色

### `Part2 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `07`

### `Git Lowering Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`

### `DB MQ Lowering Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `03`
  - `04`
  - `05`

### `Recovery Worker`

- 模型：`gpt-5.4-xhigh`
- ownership：
  - `06`

## 强依赖提醒

- 这包必须优先保证真实 lowering，不要只补更多内存态 helper。
- git / db / redis 的 readback 口径必须统一，不要各写各的 truth。
- `07` 必须在前 6 项收稳后再做。

## 最小验收口径

- `commit / projection / package / delivery / history` 都有真实 shared infra lowering 证据。
- `readback / recovery / smoke` 能读到 shared infra 结果，而不只读 runtime 内存态。
