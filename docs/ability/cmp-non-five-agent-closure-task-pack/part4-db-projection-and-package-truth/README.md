# CMP Non-Five-Agent Part 4 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 4 负责把：

- projection
- context package

真正收成以 `DB` 为真，而不是先以 runtime 内存态为真。

## 推荐文件列表

- `00-db-truth-freeze.md`
- `01-projection-write-readback-mainline.md`
- `02-package-write-readback-mainline.md`
- `03-git-fallback-backfill.md`
- `04-db-truth-rebuild-and-repair.md`
- `05-cross-part-db-gates.md`

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

- `Part4 Lead`
- `Projection Truth Worker`
- `Package Truth Worker`

## 最小验收口径

- projection/package 已经 DB-first
- git fallback backfill 规则成立
- repair/rebuild 有最小闭环
