# Part 1 / 04 Request History Fallback Contract

状态：指导性冻结稿。

更新时间：2026-03-25

## 当前结论

`requestHistory` 的 fallback 合同固定为：

1. 优先 `DB projection`
2. `DB` 不足时允许 `git checked/promoted` rebuild
3. rebuild 结果必须显式标记 degraded
4. 后续应把 rebuild 结果补回 `DB`

## fallback 原因

当前建议只保留：

- `projection_missing`
- `db_readback_incomplete`
- `db_unavailable`

## 当前不要做错的事

- 不要在 `DB` 缺失时直接把历史判成完全不可用。
- 不要在没有 `git checked` 真相时硬造 degraded 结果。
- 不要返回“找到了”，却不说明到底是从哪层真相拿到的。
