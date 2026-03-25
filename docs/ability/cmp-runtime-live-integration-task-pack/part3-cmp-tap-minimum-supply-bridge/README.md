# CMP Runtime Live Integration Part 3 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 3 负责把 `CMP <-> TAP` 的最小能力与外围供给接缝接起来。

这里不讨论：

- `TAP` 要不要接所有能力

这里只处理：

- `CMP` 下一阶段开工前，到底最少需要从 `TAP` 拿到什么

## 推荐文件列表

- `00-supply-bridge-protocol-freeze.md`
- `01-cmp-minimum-capability-baseline.md`
- `02-reviewer-and-worker-readonly-baseline.md`
- `03-repo-shell-test-skill-baseline.md`
- `04-search-skill-mcp-supply-order.md`
- `05-cmp-runtime-consumption-contract.md`
- `06-smoke-and-bridge-fixtures.md`
- `07-cross-pack-supply-gates.md`

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

### `Part3 Lead`

- 模型：`gpt-5.4-high`
- ownership：
  - `README`
  - `00`
  - `07`

### `Baseline Capability Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`
  - `02`
  - `03`

### `Extended Supply Worker`

- 模型：`gpt-5.4-high`
- ownership：
  - `04`
  - `05`
  - `06`

## 强依赖提醒

- 不要把 Part 3 写成 TAP 大跃进。
- 这里只收 `CMP` 当前必需的最小供给面，不追求大全。
- 不要让 `CMP` 直接侵入 `TAP` worker 内部职责。

## 最小验收口径

- `CMP` 的最小 capability baseline 已明确。
- `CMP` 知道从 `TAP` 拿什么，不再靠临时手搓工具。
- 后续五个 agent 的外围供给面已具备最小可用性。
