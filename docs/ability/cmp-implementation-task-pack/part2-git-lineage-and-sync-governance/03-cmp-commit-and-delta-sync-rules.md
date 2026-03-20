# 03 CMP Commit And Delta Sync Rules

## 任务目标

把 `cmp/*` 上 commit 与 context delta、snapshot candidate 的关系定死。

## 必须完成

- commit 与 `ContextDelta` 的绑定规则
- commit 与 candidate 的关系
- commit 不等于 promoted state

## ownership

- 二层：`Governance Worker`
- 模型：`gpt-5.4-high`

## 依赖前置

- `00`
- Part 1 `03`

## 最小验证义务

- 不把 commit 误当 checked / promoted

