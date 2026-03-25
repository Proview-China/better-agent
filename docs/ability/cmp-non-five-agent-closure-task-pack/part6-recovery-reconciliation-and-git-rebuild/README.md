# CMP Non-Five-Agent Part 6 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 6 负责把：

- recovery
- reconciliation
- git rebuild

这一层真正收齐。

## 推荐文件列表

- `00-recovery-freeze.md`
- `01-snapshot-vs-infra-reconciliation.md`
- `02-db-missing-git-rebuild.md`
- `03-restart-after-interruption.md`
- `04-repair-after-delivery-loss.md`
- `05-recovery-smoke-matrix.md`
- `06-cross-part-recovery-gates.md`

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

- `Part6 Lead`
- `Reconciliation Worker`
- `Git Rebuild Worker`
- `Recovery Smoke Worker`

## 最小验收口径

- recovery 已具备 snapshot + infra reconciliation
- DB 缺失时可由 git rebuild
- interruption / repair 有 smoke 证据
