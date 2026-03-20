# 02 Iterator Checker Active Line

## 任务目标

把主动模式主链 `ContextEvent -> git -> SnapshotCandidate -> CheckedSnapshot` 接起来。

## ownership

- 二层：`Agent B`
- 三层辅助：
  - `B1 iterator state push specialist`
  - `B2 checker usable-state specialist`
- 模型：
  - 主写：`gpt-5.4-high`
  - 辅助：`gpt-5.4-medium`

## 依赖前置

- `00`
- Part 2 `03/04/06` 应已稳定一版

## 最小验证义务

- 主动模式主链能形成 `CheckedSnapshot`
- merge 不等于 promotion

