# CMP Infra Closure Part 1 Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这一包是干什么的

Part 1 负责把当前的 contract / in-memory backend 推向 real backend executor 与 readback closure。

## 推荐文件列表

- `00-real-backend-protocol-freeze.md`
- `01-git-live-executor-and-process-boundary.md`
- `02-postgresql-live-executor-and-readback.md`
- `03-redis-live-executor-and-reconnect-path.md`
- `04-bootstrap-repeat-repair-and-already-exists-path.md`
- `05-readback-normalization-and-consistency-shaping.md`
- `06-error-model-retry-and-timeout-contract.md`
- `07-fixtures-and-local-live-smoke.md`
- `08-cross-backend-readback-gates.md`

## 推荐分波顺序

### Wave 0

- `00`

### Wave 1

- `01`
- `02`
- `03`

### Wave 2

- `04`
- `05`
- `06`

### Wave 3

- `07`
- `08`

## 二层 agent 角色

### `Part1 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `06`
  - `08`

### `Git Executor Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - 协同 `04`

### `Postgres Executor Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `02`
  - 协同 `05`

### `Redis Executor Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `03`
  - 协同 `05`
  - 协同 `07`

## 强依赖提醒

- `00` 不稳，其他都不要正式开写。
- `05/06` 没稳前，Part 2 不能把 readback 结果当最终 runtime truth。
- `08` 必须最后收，因为它是跨 backend gate。

## 最小验收口径

- git/pg/redis 至少各有一条真实 execution path。
- repeat bootstrap、already_exists、repair path 有证据。
- readback 能被规整成稳定结构，而不是靠调用方猜。
