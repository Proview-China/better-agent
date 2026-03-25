# Part 6 / 00 Recovery Freeze

状态：Part6 冻结稿。

更新时间：2026-03-25

## 当前目标

在不修改 `runtime.ts` 的前提下，先把 recovery 的“前置对账能力”收出来。

这一小块当前只收：

- snapshot vs infra reconciliation helper
- 相关测试
- 当前仍未覆盖的恢复缺口

## 当前不做的事

- 不直接把 recovery 主线接回 `runtime.ts`
- 不把 DB-missing -> git rebuild 全部做完
- 不做最终恢复策略拍板

## 当前冻结口径

- recovery 不是只看 snapshot
- recovery 也不是只看 infra
- 当前阶段先做：
  - “两边状态有没有对上”
  - “缺了什么”
  - “建议优先从哪边恢复”

## 当前最小完成定义

至少能回答每个 project：

- snapshot 有没有这个 project
- infra 有没有这个 project
- snapshot repo 在不在
- branch runtime / mq bootstrap 缺不缺
- lineage 是否对齐
- 当前建议是：
  - `none`
  - `hydrate_from_snapshot`
  - `hydrate_from_infra`
  - `reconcile_snapshot_and_infra`
