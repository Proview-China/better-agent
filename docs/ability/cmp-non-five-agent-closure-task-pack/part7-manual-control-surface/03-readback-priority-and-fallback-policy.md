# Part 7 / 03 Readback Priority And Fallback Policy

状态：指导性任务文档。

更新时间：2026-03-25

## 本文件要解决什么

先把手动控制里的：

- readback priority
- fallback policy
- recovery preference

收成正式 truth-control 字段。

## 当前要求

- `readbackPriority` 至少支持：
  - `git_first`
  - `db_first`
  - `redis_first`
  - `reconcile`
- `fallbackPolicy` 至少支持：
  - `git_rebuild`
  - `degraded`
  - `strict_not_found`
- `recoveryPreference` 至少支持：
  - `snapshot_first`
  - `infra_first`
  - `reconcile`
  - `dry_run`

## 当前目的

这一层现在先只做：

- 类型
- 默认值
- merge/override 规则
- 测试
