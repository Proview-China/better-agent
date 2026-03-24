# CMP Infra Real Backend And Bootstrap Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-24

## 这份文档要回答什么

`CMP` 的四部分协议和 runtime 样板已经落完了。

现在真正卡住后续五个 agent 实体化与整链联调的，不再是：

- object model
- lineage governance
- projection contract
- runtime flow

而是下面这些更硬的 infra 问题：

1. `CMP` 要接哪套真实基础设施。
2. `git / PostgreSQL / Redis` 各自到底承担什么责任。
3. 当前 in-memory runtime 样板，应该怎样迁移成真实 infra backend。
4. 五个 `CMP` agent 与 infra 的真实依赖关系是什么。
5. bootstrap、恢复、观测、验证应该先做到什么程度，才允许进入五个 agent 的默认配置与联调。

一句白话：

- 这份文档不是再解释 `CMP` 是什么
- 而是解释“怎样把已经设计好的 `CMP` 真正接到轮子上”

## 先说结论

- `CMP` 的真实 infra 当前应固定为：
  - `git`
  - `PostgreSQL`
  - `Redis`
- `git` 仍然是 `CMP` 的 canonical history backbone，也就是历史主干。
- `PostgreSQL` 负责 `CMP DB`，也就是结构化投影、交付记录、共享控制表。
- `Redis` 负责 `CMP MQ`，也就是邻接传播、实时事件广播、轻量队列/订阅面。
- 当前最稳妥的落地顺序不是先把五个 agent 拆成独立服务，而是：
  1. 先把真实 infra adapter 和 bootstrap 接进现有 runtime
  2. 再把五个 agent 做成 runtime 内可配置、可联调的真实角色
  3. 最后再决定是否把它们拆成独立进程/服务

## 当前现状与下一阶段边界

### 已经完成的部分

- `CMP` 的四个部分协议已经完成：
  - core interface + canonical object model
  - git lineage + sync governance
  - DB projection + MQ neighborhood propagation
  - five-agent runtime + active/passive flow
- `AgentCoreRuntime` 已经接入了 `CMP` 主链：
  - `ingestRuntimeContext(...)`
  - `commitContextDelta(...)`
  - `resolveCheckedSnapshot(...)`
  - `materializeContextPackage(...)`
  - `dispatchContextPackage(...)`
  - `requestHistoricalContext(...)`
  - snapshot / recovery 相关入口
- 当前这条链已经能在 runtime 内存态中闭环，并有测试证明。

### 还没有完成的部分

- 还没有把 `cmp-db` 真正接到 `PostgreSQL`
- 还没有把 `cmp-mq` 真正接到 `Redis`
- 还没有把 `git` 仓库与 branch family bootstrap 做成真实项目底座
- 还没有把五个 `CMP` agent 做成带默认配置、真实 IO、真实恢复链的运行实体

### 所以下一阶段的唯一目标

先完成 `CMP infra`，再进入五个 agent 的实际化。

## `CMP infra` 的三件套

## 1. `git infra`

### 定位

- 一个项目一个 `repo`
- 这个 repo 是项目级历史主干，不是 `CMP` 私有仓库
- `CMP` 只负责系统化消费 `cmp/*` 线，但必须理解整个 branch family

### 最小必须能力

- 项目 repo bootstrap
- branch family bootstrap
- agent lineage -> branch family 映射
- `cmp/<agent-id>` 的 commit / PR / merge / promotion 基础操作
- checked ref / promoted ref / branch head 的持久化读写

### 这一层不负责什么

- 不负责高层 package materialization
- 不负责自己判定 DB visibility
- 不负责替代 checker 的状态裁决

## 2. `CMP DB` on `PostgreSQL`

### 定位

- 一个项目一个 `CMP DB`
- 它是结构化投影层、索引层、交付层
- 它不是第二真相源

### 最小必须能力

- 共享控制表初始化
- agent-local hot tables 初始化
- `CheckedSnapshot -> Projection` 持久化
- `ContextPackage -> PackageRecord` 持久化
- `DispatchReceipt -> DeliveryRegistry` 持久化
- DB bootstrap / migration / schema versioning

### 这一层不负责什么

- 不负责保存未经 checker 认可的 raw truth 作为第二历史源
- 不负责 embedding / RAG / vector retrieval
- 不负责替代 git history

## 3. `CMP MQ` on `Redis`

### 定位

- 一个项目一套 `Redis` topic / stream / queue 空间
- 它负责实时传播，不负责长期事实保存
- 它只能表达邻接传播，不是全局自由广播系统

### 最小必须能力

- topic / channel bootstrap
- parent / peer / child routing
- ICMA publish envelope lowering
- subscription guards
- critical escalation exception lane
- delivery acknowledgement / lightweight retry signal

### 这一层不负责什么

- 不负责长期保留历史上下文
- 不负责全局广播
- 不负责越权订阅

## 为什么当前选 `PostgreSQL + Redis`

## `PostgreSQL`

原因：

- 更适合 `CMP` 这种强结构化、强状态机、强一致性投影层
- 更适合表达共享控制表、agent-local tables、promotion/delivery registry
- 更适合后续做 migration、read model、运维检查和 SQL 级审计

一句白话：

- `CMP DB` 不是拿来“模糊找相似内容”的，而是拿来“精确记录当前治理状态”的

## `Redis`

原因：

- 更适合做低延迟邻接传播
- 更适合 `ICMA -> iterator/checker/dbagent/dispatcher` 这种实时协作
- 更容易做短期队列、topic、ack 和失败重试信号

一句白话：

- 这里要的是“快”和“轻”，不是再造一个数据库

## 为什么现在不先拆独立服务

当前不建议第一步就把五个 agent 拆成五个常驻服务进程，原因有 4 个：

1. 当前仓库里已经有一条可运行的 runtime 主链，最小改造成本是把真实 infra 接进去。
2. 如果先拆服务，问题会混在一起：
   - infra 接线问题
   - agent 职责问题
   - 进程边界问题
   - recovery / supervision 问题
3. 先在同一 runtime 内把五个角色做真实化，更容易验证协议是否正确。
4. 等整链跑顺后，再决定要不要做进程级拆分，风险最小。

## `CMP infra` 的四层落地结构

## Layer 1. Infra Resource Layer

包含：

- repo
- PostgreSQL database
- Redis namespace

职责：

- 提供真实资源
- 提供 bootstrap、配置、连接与可达性检查

## Layer 2. Infra Adapter Layer

包含：

- git adapter
- postgres adapter
- redis adapter

职责：

- 把外部轮子翻译成 `CMP` 当前协议能使用的最小操作面

例如：

- git branch/ref/commit/primitives
- projection/package/delivery persistence
- publish/subscribe/ack primitives

## Layer 3. CMP Persistence And Messaging Layer

包含：

- `cmp-git`
- `cmp-db`
- `cmp-mq`

职责：

- 继续保留现在已经存在的协议与状态机
- 但底层不再默认只靠 `Map` 和 helper，而是能通过 adapter 落到真实 infra

## Layer 4. CMP Runtime And Agent Layer

包含：

- `cmp-runtime`
- `AgentCoreRuntime` 中的 `CMP` 接缝
- 五个 `CMP` agent 的默认配置与运行角色

职责：

- 把前面三层组装成真正可运行的主动/被动链

## bootstrap 要解决什么

`CMP infra bootstrap` 当前至少要回答下面这些问题：

1. 新项目启动时，怎样初始化：
   - repo
   - branch family
   - PostgreSQL schema
   - Redis topic/stream namespace
2. 新 agent 派生时，怎样初始化：
   - `work/<agent>`
   - `cmp/<agent>`
   - `mp/<agent>`
   - `tap/<agent>`
   - 对应 DB local tables / logical ownership
   - 对应 MQ neighborhood wiring
3. 恢复时，怎样从：
   - git refs
   - DB projection
   - MQ runtime signals
   - checkpoint snapshot
   重建 `CMP` runtime 工作态

## 与五个 agent 的关系

## `ICMA`

依赖：

- Redis publish
- lineage neighborhood topology
- runtime ingest contract

它最先需要真实化的是：

- 入站材料截获后的 envelope lowering
- parent / peer / child 发送面

## `Iterator`

依赖：

- git branch/ref/commit primitives
- repo bootstrap

它最先需要真实化的是：

- `cmp/*` 分支推进
- candidate 形成
- PR/merge 驱动基础

## `Checker`

依赖：

- checked ref / promoted ref
- lineage guard
- promotion gate

它最先需要真实化的是：

- checked snapshot 落点
- promotion 判定和写入

## `DBAgent`

依赖：

- PostgreSQL projection persistence
- package registry
- delivery registry

它最先需要真实化的是：

- checked snapshot -> projection
- projection -> package
- dispatch -> delivery registry

## `Dispatcher`

依赖：

- runtime delivery planning
- Redis / DB receipt synchronization
- lineage visibility enforcement

它最先需要真实化的是：

- parent / peer / child 分发
- core-agent return
- ack / readback / retry signal

## 本轮 infra 实施的最小完成定义

`CMP infra` 这一轮不要求一上来就把整个系统做成分布式平台。

但至少要完成下面这些硬门槛：

1. 有真实的项目 bootstrap 能力
   - repo
   - PostgreSQL schema
   - Redis namespace
2. `cmp-git / cmp-db / cmp-mq` 不再只是纯内存 helper，而是有真实 backend adapter
3. `AgentCoreRuntime` 可以在真实 infra 上跑通最小主动链和被动链
4. 五个 agent 可以开始在真实 infra 上配置默认角色
5. checkpoint / recovery 至少能和真实 backend 做基本一致性回读

## 当前不建议做的事

- 不要在这一步把 `MP` 一起混进来做。
- 不要把 `CMP DB` 和 `MP` 的 `LanceDB` 混成一层。
- 不要先做一套自制数据库或自制消息队列。
- 不要先把五个 agent 拆成独立服务再回头补 infra。
- 不要为了“以后可能复用”而提前做过重的平台抽象。

## 建议的后续文档顺序

在这份总纲之后，建议再拆出一包 `CMP infra` 详细任务清单。

这包任务清单至少应继续拆成：

1. `git infra bootstrap and branch family runtime`
2. `PostgreSQL schema and cmp-db adapter`
3. `Redis topic/stream routing and cmp-mq adapter`
4. `runtime wiring, recovery, and infra verification gates`

一句话收口：

- `CMP` 的协议和样板已经够了
- 现在该把轮子接上，把这套治理链真正跑起来
