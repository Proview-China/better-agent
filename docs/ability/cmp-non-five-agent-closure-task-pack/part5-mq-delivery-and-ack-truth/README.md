# CMP Non-Five-Agent Part 5 Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这一包是干什么的

Part 5 负责把：

- dispatch
- ack
- expiry

这类投递状态真正收成以 `Redis` 为真。

## 推荐文件列表

- `00-delivery-truth-freeze.md`
- `01-dispatch-publish-mainline.md`
- `02-ack-mainline.md`
- `03-expiry-and-retry-contract.md`
- `04-db-projection-of-delivery-truth.md`
- `05-cross-part-mq-gates.md`

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

- `Part5 Lead`
- `Dispatch Ack Worker`
- `Expiry Retry Worker`

## 最小验收口径

- dispatch/ack/expiry 以 Redis 为真
- DB 侧能做结构化投影与回读
