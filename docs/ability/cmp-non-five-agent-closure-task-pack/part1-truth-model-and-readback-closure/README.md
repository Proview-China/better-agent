# CMP Non-Five-Agent Part 1 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 1 负责把：

- `git / DB / Redis`

三层真相边界，以及 readback / degraded / rebuild 规则收成统一合同。

## 推荐文件列表

- `00-truth-model-freeze.md`
- `01-object-truth-matrix.md`
- `02-readback-priority-and-degraded-contract.md`
- `03-git-db-redis-conflict-resolution.md`
- `04-request-history-fallback-contract.md`
- `05-cross-part-truth-gates.md`

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

## 推荐二层 agent

- `Part1 Lead`
- `Truth Matrix Worker`
- `Readback Contract Worker`

## 最小验收口径

- 真相源分层已明确
- degraded/readback/fallback 口径已统一
- `requestHistory` 的 git rebuild 条件已冻结
