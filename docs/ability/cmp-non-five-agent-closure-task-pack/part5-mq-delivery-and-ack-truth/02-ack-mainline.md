# Part 5 / 02 Ack Mainline

状态：任务说明。

更新时间：2026-03-25

## 当前目标

在 publish truth 的基础上，补一条最小 ack 主线：

- 允许按 `receiptId` 回读 delivery truth
- 允许按 `receiptId` 写入 `acknowledged`

## 当前验收口径

至少要成立：

1. publish 后能 readback 到 `published`
2. ack 后能 readback 到 `acknowledged`
3. parent / peer / child 邻接纪律不能被破坏

## 下一步留口

这一小块收完后，下一步才适合继续扩：

- expiry
- retry
- DB delivery projection
