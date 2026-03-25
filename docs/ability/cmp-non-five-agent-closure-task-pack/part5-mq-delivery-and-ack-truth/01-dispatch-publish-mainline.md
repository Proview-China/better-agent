# Part 5 / 01 Dispatch Publish Mainline

状态：任务说明。

更新时间：2026-03-25

## 当前目标

让 publish 不再只返回一个瞬时 receipt，而是同时落下一条：

- `delivery truth record`

## 这条 truth 至少应表达

- `receiptId`
- `projectId`
- `sourceAgentId`
- `channel`
- `lane`
- `redisKey`
- `targetCount`
- `state=published`
- `publishedAt`

## 白话解释

以前 publish 更像“我说我发了”。

现在要变成：

- `Redis` 里确实有一条可回读的“我已经发了”的记录。
