# Part 0 / 05 Final Integration And Acceptance

状态：主线程编排文档。

更新时间：2026-03-25

## 最终集成目标

在不进入五个 agent 的前提下，让 `CMP` 至少达到：

- 有分层真相源
- 有 section-first lowering
- 有本地 git workflow realism
- 有 DB projection/package truth
- 有 Redis delivery truth
- 有 recovery / reconciliation
- 有手动全过程控制
- 有 final non-five-agent gates

## 主线程最终动作

### 动作 1

统一接高冲突主线文件。

### 动作 2

统一跑：

- `typecheck`
- `build`
- 关键主链测试
- helper tests
- smoke / readback matrix

### 动作 3

输出：

- 已完成部分
- 未完成缺口
- 是否可以进入五个 agent 阶段

## 当前阶段验收口径

只有同时满足下面这些条件，才允许主线程宣布本轮 close：

1. 主链测试通过
2. truth/readback 口径统一
3. degraded / rebuild / recovery 至少有最小证据
4. manual control 已不是口头约定
5. final non-five-agent gates 已文档化
