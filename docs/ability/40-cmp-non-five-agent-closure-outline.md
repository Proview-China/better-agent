# CMP Non-Five-Agent Closure Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-25

## 这份文档要回答什么

到当前阶段，`CMP` 已经完成了一轮关键进展：

- `rax.cmp` full workflow surface 已经成立
- `cmp_action` 已经进入 kernel / transition / runtime loop
- `shared git / PostgreSQL / Redis` 的第一层真实 lowering 已经开始接入
- `readback / smoke / summary` 已经有了第一层观测面

但这还不等于：

- `CMP` 里和五个 agent 无关的部分已经全部收完
- `git / DB / MQ` 已经形成真正的分层真相体系
- `Section / StoredSection / Rules` 已经成为主运行链
- 本地 git 工作流已经足够接近图里的“类人协作治理”
- `CMP` 已经具备“默认自动可用 + 手动全过程可控”的双重入口

这份文档专门处理一个问题：

- 在不进入五个 agent 实现的前提下，`CMP` 还必须完成哪些 closure area，才能算把自己的底座、真相源、工作流和控制面收齐

一句白话：

- 这轮不做五个 agent
- 这轮要把 `CMP` 自己先焊死

## 先说结论

- 当前 `CMP` 还没有到“只差五个 agent”的阶段。
- 在五个 agent 开工前，`CMP` 还必须继续完成 6 类收口：
  1. infra truth closure
  2. section-first lowering closure
  3. local git realism closure
  4. db package/projection truth closure
  5. delivery/recovery/manual control closure
  6. pre-five-agent final gates
- 这轮不再优先推进 `CMP <-> TAP` 强绑定。
- `TAP` 这轮只保留未来桥位，不作为当前 `CMP` 收口的阻塞前提。

## 当前冻结共识

下面这些方向在这轮默认视为冻结前提：

### 1. 真相源分层

- `git`：
  - 历史主干
  - checked / promoted
  - 同步后的可复用真相
- `DB`：
  - projection
  - context package
  - 结构化交付面
- `Redis`：
  - dispatch / ack / expiry
  - 实时投递状态真相

一句白话：

- 历史以 `git` 为真
- 包和投影以 `DB` 为真
- 投递状态以 `Redis` 为真

### 2. passive fallback

当 `request_historical_context` 时：

- 如果 `DB` projection 还没有准备好
- 但 `git` checked / promoted refs 已存在

则：

- 允许由 agent 从 `git` 重建最小历史 package
- 并在随后把结果补回 `DB`

### 3. `Section / StoredSection / Rules`

下一步 lowering 方式固定为：

- 所有 ingest materials 先进入 `Section`
- 再按规则进入 `StoredSection`
- 再推动 checked / projection / package / dispatch

不再推荐：

- 只在 checked 之后才开始映射 `Section`

### 4. `git` workflow realism

这轮 `CMP` 对 git 的要求不是“继续逻辑化占位”，而是：

- 尽可能接近真实本地 git 工作流
- 用本地 branch / ref / merge / promote / rollback 去模拟人类协作
- 同时保留未来和 GitHub PR 对齐的口子

一句白话：

- 先把本地 git 工作流做得像真人
- 以后再更完整接到 GitHub

### 5. `CMP` 入口形态

当前希望 `CMP` 同时具备两种能力：

- 默认自动可用
  - `core_agent` 正常运行时可进入 `CMP`
- 手动全过程可控
  - 使用者可以手动限制范围、模式、真相读取策略、回退策略、dispatch 策略

也就是说：

- `CMP` 不是纯黑盒
- 也不是纯手动脚手架

## 为什么这一轮要换成“高并行收口包”

原因有 4 个：

1. 现在不再是“有没有模块”，而是“每一层还差多少真实度”。
2. 这些任务可以按对象、通道、真相层、控制面切成很多平行子问题。
3. 如果继续只用 4-Part 的大包，很容易让所有改动都挤进 `runtime.ts`，冲突太高。
4. 图里需要的，其实就是一种更像人类团队的并行治理方式。

所以这轮应该显式支持：

- `1` 个主线程编排层
- `8` 个二层 lead
- `16+` 个三层 worker
- 主线程单点集成高冲突文件
- `verification/readback` sidecar worker 与实现 worker 分离

## 这轮的 8 个 closure area

## Area 1. Truth Model Closure

目标：

- 把 `git / DB / Redis` 各自负责什么，落实成真正可回读的 runtime contract

包含：

- truth precedence
- readback shape
- degraded / rebuild rules

## Area 2. Section-First Ingress Closure

目标：

- 让所有 ingest materials 先进入 `Section`
- 再由 `Rules` 推到 `StoredSection` 和后续链路

包含：

- exact section
- stored section
- rule evaluation
- section-driven commit/materialize/requestHistory

## Area 3. Git Workflow Realism Closure

目标：

- 把本地 `cmp/*` 线推进到更接近真实人类 git workflow

包含：

- real commit
- checked refs
- promoted refs
- local PR / merge / promotion records
- rollback / repeat / repair path

## Area 4. DB Truth Closure

目标：

- 把 projection / package 变成真正以 `DB` 为真，而不是先以 runtime `Map` 为真

包含：

- projection rebuild
- package rebuild
- readback truth
- git-fallback backfill

## Area 5. MQ Delivery Truth Closure

目标：

- 把 dispatch / ack / expiry 的最终真相收在 `Redis`

包含：

- publish
- ack
- expiry
- replay-ready delivery readback

## Area 6. Recovery And Reconciliation Closure

目标：

- 把 recovery 从 snapshot-first 推向 infra-reconciled

包含：

- snapshot vs infra reconciliation
- git/db/mq readback merge
- interruption recovery
- passive rebuild after restart

## Area 7. Manual Control Surface Closure

目标：

- 把“默认自动可用 + 手动全过程可控”变成正式控制面

包含：

- active/passive switch
- lineage scope
- dispatch scope
- readback priority
- fallback policy
- rebuild policy
- auto-return / auto-seed 开关

## Area 8. Final Non-Five-Agent Gates

目标：

- 在不进入五个 agent 的前提下，明确 `CMP` 自己的 final acceptance gates

包含：

- end-to-end smoke matrix
- degraded matrix
- local git realism evidence
- rebuild evidence
- manual control evidence
- five-agent-ready handoff gate

## 当前不要做错的事

- 不要重新回到“只有 runtime 内存态是主线”的实现方向。
- 不要把 `Section` 继续放在域模型层不真正 lower。
- 不要只做 refs，不做 workflow realism。
- 不要因为 `TAP` 还在调，就把 `CMP` 自己的收口停住。
- 不要把“默认自动可用”和“手动全过程可控”二选一。
- 不要把所有改动都塞进 `runtime.ts`。
- 不要让同一个 worker 同时负责“实现 + 自己给自己验收结论”。

## 这一轮的最小完成定义

只有同时满足下面这些条件，才算 `CMP` 非五-agent部分真正收口：

1. `git / DB / Redis` 的真相边界已落实到 runtime 与 readback。
2. `Section / StoredSection / Rules` 已进入主运行链。
3. `requestHistory` 在 projection 缺失时可以从 `git` 重建。
4. 本地 git workflow 已具备 checked / promoted / merge / repair 的近似真实链。
5. dispatch / ack / expiry 已以 `Redis` 为真，`DB` 为投影。
6. recovery 已具备 snapshot + infra reconciliation。
7. 手动全过程控制面已经存在。
8. `CMP` 的 final non-five-agent gate 已明确。

## 建议的后续文档顺序

在这份总纲之后，建议紧接着拆一包：

- `cmp-non-five-agent-closure-task-pack`

这一包建议拆成 8 个 part，对应上面 8 个 closure area。

一句收口：

- 这一轮不是继续补边角
- 这一轮是在把 `CMP` 自己做成一个真正能独立站住的系统
