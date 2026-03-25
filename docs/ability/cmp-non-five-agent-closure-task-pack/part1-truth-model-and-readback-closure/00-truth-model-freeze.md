# Part 1 / 00 Truth Model Freeze

状态：冻结稿。

更新时间：2026-03-25

## 当前目标

把 `CMP` 的分层真相模型和 readback/degraded/fallback 口径冻结下来。

## 已冻结前提

- `git`：
  - 历史
  - checked
  - promoted
- `DB`：
  - projection
  - package
- `Redis`：
  - dispatch
  - ack
  - expiry

## 当前明确要求

- `requestHistory` 在 DB projection 缺失时，允许 git rebuild
- readback 必须能区分：
  - ready
  - degraded
  - rebuild-needed
  - not-found

## 当前不做

- 不在这一包里决定五个 agent 怎么使用这些 truth
- 不在这一包里强接 TAP
