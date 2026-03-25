# Part 0 / 00 Wave 0 Scope Freeze

状态：主线程冻结稿。

更新时间：2026-03-25

## 当前唯一目标

在不进入五个 agent 实现的前提下，把 `CMP` 自己先收成：

- 有分层真相源
- 有 section-first lowering
- 有本地 git 近似真实工作流
- 有 DB / Redis 真相闭环
- 有 recovery / reconciliation
- 有默认自动可用 + 手动全过程可控
- 有 final non-five-agent acceptance gates

## 当前明确不做的事

- 不做五个 agent prompt/config/职责细调
- 不做 `MP` 正式实现
- 不做 `CMP <-> TAP` 强绑定
- 不把 GitHub 远端 PR 流作为这轮阻塞前提

## 当前冻结前提

- `git`：
  - 历史 / checked / promoted 真相层
- `DB`：
  - projection / package 真相层
- `Redis`：
  - dispatch / ack / expiry 真相层
- `requestHistory`：
  - DB 缺失时允许从 git rebuild
- `Section`：
  - 所有 ingest materials 先成 exact section
- `CMP` 入口：
  - 默认自动可用
  - 同时允许手动全过程控制

## 第一批施工范围

第一批只允许推进：

- Part 1: truth model/readback
- Part 2: section-first lowering
- Part 3: local git realism
- Part 4: db truth
- Part 5: mq truth
- Part 6: recovery/reconciliation
- Part 7: manual controls
- Part 8: gates/evidence

## 第一批禁止区

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`

这些文件默认只允许主线程集成。
