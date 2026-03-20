# CMP Part 1 Task Pack

状态：并行编码任务包。

更新时间：2026-03-20

## 这一包是干什么的

Part 1 负责把 `CMP` 的核心 interface、canonical object model、最小 runtime 接缝和合同测试闸门先钉死。

如果这包不先收稳：

- Part 2 的 git lineage 规则会缺对象锚点
- Part 3 的 projection / package / receipt 会缺类型锚点
- Part 4 的 runtime assembly 会反复改接口

## 推荐文件列表

- `00-part1-protocol-freeze.md`
- `01-core-agent-cmp-interface-contract.md`
- `02-agent-lineage-and-branch-family-model.md`
- `03-context-event-and-context-delta-model.md`
- `04-snapshot-candidate-and-checked-snapshot-model.md`
- `05-promoted-projection-and-context-package-model.md`
- `06-dispatch-receipt-sync-event-and-escalation-alert.md`
- `07-runtime-entrypoints-and-state-boundary.md`
- `08-contract-tests-doc-readback-and-integration-gates.md`

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

### Wave 3

- `06`
- `07`

### Wave 4

- `08`

## 强依赖提醒

- `00` 没完成前，不要动其他文件。
- `03` 没收稳前，不建议真正开写 `04`。
- `04` 没收稳前，不建议真正开写 `05`。
- `01-06` 没收稳前，不要写 `07`。
- `08` 必须最后做。

## 二层 agent 角色

### `Part1 Lead`

- 模型：`gpt-5.4-high`
- 负责：
  - `00`
  - 最终 `07`
  - 最终 `08`
  - 跨文件一致性与对外依赖检查

## 三层 agent 角色

### `L3-A interface specialist`

- 模型：`gpt-5.4-high`
- ownership：
  - `01`

### `L3-B lineage/model specialist`

- 模型：`gpt-5.4-high`
- ownership：
  - `02`
  - `03`

### `L3-C checked/projection/package specialist`

- 模型：`gpt-5.4-high`
- ownership：
  - `04`
  - `05`

### `L3-D sync/dispatch specialist`

- 模型：`gpt-5.4-high`
- ownership：
  - `06`

### `L3-E doc/test finisher`

- 模型：`gpt-5.4-medium`
- ownership：
  - `08` 的回读清单、测试清单、链接核验辅助

## 与其它 Part 的依赖

- Part 2 强依赖：
  - `02`
- Part 3 强依赖：
  - `05`
  - `06`
- Part 4 强依赖：
  - `01-07`

## 最小验收口径

- 术语与 [29-cmp-context-management-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/29-cmp-context-management-pool-outline.md) 完全对齐。
- 不把 `CMP` 写成 `TAP` 的 capability 变体。
- 产出明确的跨 Part 联调闸门。

