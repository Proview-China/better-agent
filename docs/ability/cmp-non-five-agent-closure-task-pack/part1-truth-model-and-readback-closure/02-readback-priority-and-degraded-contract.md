# Part 1 / 02 Readback Priority And Degraded Contract

状态：指导性冻结稿。

更新时间：2026-03-25

## 当前结论

`CMP` 的 readback 采用对象分层真相：

- `git`
  - 历史 / checked / promoted
- `DB`
  - projection / package
- `Redis`
  - dispatch / ack / expiry

## degraded 规则

如果 `DB projection` 可用且 readback 完整：

- 走 `db_projection`
- 结果不是 degraded

如果 `DB projection` 缺失或 `DB` readback 不完整，但 `git checked/promoted` 仍存在：

- 允许 fallback 到 `git_checked`
- 结果标记为 degraded

## 返回要求

历史读回至少要能说明：

- `preferredSource`
- `resolvedSource`
- `degraded`
- `reason`
- `snapshotId`
