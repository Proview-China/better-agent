# 04 Snapshot Candidate And Checked Snapshot Model

## 任务目标

冻结 checker 之前和 checker 之后的对象边界。

## 必须完成

- 收 `SnapshotCandidate`
- 收 `CheckedSnapshot`
- 说明两者如何承接 commit / PR / merge 之后的状态甄选

## ownership

- 三层：`L3-C checked/projection/package specialist`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`
- `03`

## 串并行位置

- 在 `03` 收稳后推进

## 最小验证义务

- 能表达“commit 不等于 checked，merge 不等于 promoted”

