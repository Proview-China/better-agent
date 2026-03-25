# Part 4 / 00 DB Truth Freeze

状态：冻结稿。

更新时间：2026-03-25

## 当前目标

把 projection/package 层收成 `DB-first truth`。

## 已冻结前提

- `DB` 对：
  - projection
  - package
  为真

## 当前明确要求

- runtime 内存态不能继续成为 projection/package 的最终真相
- 必须具备：
  - write
  - readback
  - degraded handling
  - git fallback backfill 支点

## 当前不做

- 不在这一包里决定 Redis delivery truth
- 不直接改 `runtime.ts`
