# Part 5 / 00 Delivery Truth Freeze

状态：冻结稿。

更新时间：2026-03-25

## 当前冻结方向

- `Redis` 对 dispatch / ack / expiry 为真
- `DB` 对 delivery 的长期结构化投影为真
- delivery 真相不回退成 runtime 内存主线

## 当前最小要求

- publish 有 truth record
- ack 有 truth transition
- expiry/retry 有显式 contract
- DB 侧有 projection patch 接口
