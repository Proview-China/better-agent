# CMP Non-Five-Agent Part 7 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 7 负责把：

- 默认自动可用
- 手动全过程可控

这两种能力同时收成正式控制面。

## 推荐文件列表

- `00-manual-control-freeze.md`
- `01-active-passive-mode-switch.md`
- `02-lineage-and-dispatch-scope.md`
- `03-readback-priority-and-fallback-policy.md`
- `04-auto-return-and-auto-seed-switches.md`
- `05-full-manual-runbook.md`
- `06-cross-part-manual-control-gates.md`

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

## 推荐二层 agent

- `Part7 Lead`
- `Mode Scope Worker`
- `Fallback Policy Worker`
- `Manual Runbook Worker`

## 最小验收口径

- 自动模式和手动全过程控制都存在
- 范围、回退、重建、auto-return/seed 都可控
