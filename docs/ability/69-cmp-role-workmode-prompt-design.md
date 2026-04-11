# CMP Role Workmode Prompt Design

状态：角色工位提示词工程说明稿。

更新时间：2026-04-11

## 这份文档回答什么

这份文档专门回答：

1. `CMP` 五角色的 prompt engineering 当前为什么这样设计。
2. 每个角色在真实工作流里到底像什么工位。
3. 为什么当前最佳候选不是“全角色统一一套 prompt 风格”，而是按工位混合取优。

一句白话：

- 这份文档不是跑测试。
- 它是给人审查“角色提示词到底是不是贴工作方式”的说明书。

## 当前结论

当前最佳候选是：

- `workmode_v8`

它的策略不是把五角色都改成同一种“工作方式版”，
而是：

- `ICMA / Iterator / Dispatcher` 继续保留更窄、更稳的 baseline 风格
- `Checker / DBAgent` 使用更贴真实工位的 `workmode_v6` 风格

当前判断：

- `CMP` 的最优提示词工程不应该追求“风格统一”
- 而应该追求“工位正确”

## 角色工位定义

## 1. `ICMA`

当前工位定义：

- 前处理工位

它真正负责：

- 接住混乱的 runtime material
- 把材料变成后续可处理的 package preform
- 开始把信噪比往正确方向拉
- 为下游保留 source anchor、intent chunk、operator guide、child guide

它不负责：

- 最终裁决 truth
- 最终 checked
- package truth 持久化
- route 决策

所以它的 prompt 应该像：

- 前处理说明书
- 而不是最终判断说明书

当前保留 baseline 风格的原因：

- 一旦 `ICMA` 的 systemPrompt 过重，就容易诱导模型输出长解释、甚至破坏 strict JSON 纪律
- 前处理本来就允许粗糙，重点是可下游处理，而不是此处完美

## 2. `Iterator`

当前工位定义：

- 分线 / 粒度治理工位

它真正负责：

- 决定内容该落在哪条包线
- 关联弱时新开包线
- 控制粒度
- 保持 db + git 双治理路径可审查
- 为 `Checker` 提供更好检查结构

它不负责：

- 最终 checked truth
- package truth
- route

所以它的 prompt 应该像：

- 包线治理说明书
- 粒度控制说明书

当前保留 baseline 风格的原因：

- baseline 已经足够窄
- 当前没有证据证明对它做更多工作方式重写会带来更好效果

## 3. `Checker`

当前工位定义：

- 信噪比与方向守门工位

它真正负责：

- 看有没有偏离
- 看有没有噪音
- 看有没有该拆、该合、该删、该补
- 把 checked core 和 suggest-promote 分开
- 只在必要时给出结构动作

它不负责：

- git 主推进
- package truth 管理
- route

所以它的 prompt 应该像：

- 守门说明书
- 去噪与方向校正说明书

当前采用工作方式版的原因：

- baseline 的 `Checker` 虽然能用，但更像“通用 reviewer”
- 改成工作方式版后，它更像真正的信噪比守门员
- strict-live 效果和速度都更好

## 4. `DBAgent`

当前工位定义：

- 高价值 section / package truth / 持久化工位

它真正负责：

- 把 checked material 变成 durable package truth
- 标出高价值 returnable sections
- 整理 package family 脉络
- 准备 future retrieval
- 在 passive 模式下优先给出最小完整 clean historical return

它不负责：

- git 主推进
- route 决策
- peer approval

所以它的 prompt 应该像：

- 高价值 section 化说明书
- 持久化说明书
- passive clean return 说明书

当前采用工作方式版的原因：

- baseline 的 `DBAgent` 过于强调 package family 解释
- 工作方式版把重点拉回：
  - 先把历史回复做对
  - 再把结构边界保留清楚
- 尤其在 passive 模式下，这样的收益很大

## 5. `Dispatcher`

当前工位定义：

- 控制台 / 回送 / 播种纪律工位

它真正负责：

- 什么回 `core`
- 什么播给子 `ICMA`
- 什么给同级做受控背景
- 什么必须留在 lineage 内
- approval state 和 route discipline

它不负责：

- 改写 package truth
- 重新编辑内容

所以它的 prompt 应该像：

- 控制台纪律说明书
- 回送 / 播种规则说明书

当前保留 baseline 风格的原因：

- 这个角色最重要的是 contract 稳
- 当前 baseline 已经足够窄，且效果很好
- 过度工作方式化会让它变啰嗦，反而拖性能

## 为什么当前最佳是混合版

当前事实已经很清楚：

- 并不是所有角色都适合“越像人类岗位说明书越好”
- 有些角色更适合：
  - 更窄
  - 更硬
  - 更 schema-first
- 有些角色则需要：
  - 更贴工位
  - 更贴真实职责
  - 更少抽象 reviewer 腔

所以当前最佳候选不是：

- 全角色统一一套工作方式 prompt

而是：

- `ICMA / Iterator / Dispatcher`：保持窄而稳
- `Checker / DBAgent`：更贴真实工位

## 当前人审重点

如果要审这版提示词工程，最应该盯这几条：

1. `ICMA` 是否像前处理工位，而不是 final judge
2. `Iterator` 是否真的像分线 / 粒度治理员
3. `Checker` 是否像信噪比和方向守门员
4. `DBAgent` 是否像高价值 section 与持久化管理员
5. `Dispatcher` 是否像控制台，而不是内容编辑器

## 当前一句话收口

`CMP` 的提示词工程，当前最好的方向不是“统一风格”，
而是让每个角色越来越像它自己的异步工位。
