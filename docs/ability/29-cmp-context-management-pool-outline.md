# Context Management Pool Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-20

## 这份文档要回答什么

Praxis 现在已经有：

- `raw_agent_core`
- `Capability Interface + CapabilityPool`
- 默认接管 `capability_call` 的 `TAP`

下一步不再是继续扩 `TAP`，而是建立与之并列、但职责不同的 `CMP`。

这份文档要先回答下面这些问题：

1. `CMP` 在 Praxis 里到底是什么。
2. 它与 `core_agent`、`git`、`DB`、`MQ` 的关系是什么。
3. 为什么它不是一个被动记忆检索器，而是一个主动上下文治理池。
4. 为什么它必须先拆成四个指导性部分，再进入真正的代码任务拆解。

一句白话：

- `TAP` 管的是“能不能做、怎么申请能力、怎么接回执行面”
- `CMP` 管的是“上下文从哪里来、怎么演化、怎么被筛干净、怎么再高信噪比地回去”

## 先说结论

- `CMP` 应被定义为一个主动上下文治理池，而不是一个 RAG 检索层，也不是一个普通 summary service。
- `CMP` 的 canonical source 不是 embedding 库，而是 `git` 历史主干。
- `CMP` 的数据库不是事实源，而是结构化投影层和可分发产物层。
- `CMP` 的消息同步必须是有方向的邻接传播，而不是全局任意广播。
- `CMP` 的层级管理必须遵守“上级对下级的非越级操控”，并且把这条纪律同时落实到：
  - `git` 的 branch / PR / merge
  - `DB` 的 visibility / promotion
  - `MQ` 的 publish / subscribe
  - `dispatcher` 的上下文投喂

## `CMP` 的核心定义

当前建议把 `CMP` 收成下面这句话：

`CMP` 是一个以 `git` 为项目级上下文历史主干、以 `CMP DB` 为结构化投影层、以 `MQ` 为实时同步总线、以五个 agent 为治理执行面的主动上下文管理池。

它至少负责 5 件事：

1. 主动拦截 `core_agent` 的上下文输入与运行历史。
2. 把这些上下文变化转成可审计的 `git` 工作流。
3. 通过 checker 持续维护“当前可用历史状态”。
4. 通过 `DBAgent` 把 checked state 投影成高信噪比状态包。
5. 通过 dispatcher 把最佳上下文返还给主 agent 或按层级派发给子 agent。

## `CMP` 的基础设施三件套

### 1. 项目级 `git repo`

一个项目一个 `repo`。

这个 repo 不是 `CMP` 私有物，而是当前项目的历史主干。

当前建议的 branch 家族是：

- `work/<agent-id>`
- `cmp/<agent-id>`
- `mp/<agent-id>`
- `tap/<agent-id>`

例如主 agent 默认可拥有：

- `work/main`
- `cmp/main`
- `mp/main`
- `tap/main`

子 agent `yahoo` 则拥有：

- `work/yahoo`
- `cmp/yahoo`
- `mp/yahoo`
- `tap/yahoo`

### 2. 项目级 `CMP DB`

一个项目一个 `CMP DB`。

它只服务 `CMP`，不与后续 `MP` 的 RAG/向量存储混用。

它不是历史真相源，而是：

- 结构化索引层
- checked state 投影层
- context package / skill 交付层

### 3. 项目级 `MQ`

一个项目一套实时消息总线。

它负责让：

- `ICMA`
- `iterator`
- `checker`
- `DBAgent`
- `dispatcher`

之间保持实时同步，而不依赖低效轮询。

但 `MQ` 的广播不是无约束的。

## `CMP` 的两种运行模式

### 主动模式

这是 `CMP` 的主模式。

`ICMA` 直接插手 `core_agent` 的上下文输入与运行时历史，把这些变化转成：

- `git` 历史变更
- checked snapshot 候选
- DB projection 更新
- 可分发的上下文包

最终由 dispatcher 回填给：

- 主 agent
- 直属子 agent 的 `ICMA`

### 被动模式

当主 agent 需要看历史、依赖、状态缩影时，被动向 `CMP` 发请求。

`CMP` 返回的不是原始杂乱历史，而是：

- 当前最佳 checked snapshot
- 面向该调用场景的高信噪比 context package

## 层级治理总纪律

`CMP``/MP/TAP` 与 `work` 线都必须默认遵守：

- 子节点只能直接向直属父节点提交提升申请
- 父节点才有权把下级内容继续提升到更上层
- 默认不允许越级同步 raw history / raw event / raw snapshot
- 同级之间可以交换信息
- 子代之间的跨父级传播必须由父节点中转

一句白话：

- 3 级不能默认越过 2 级直接打扰 1 级
- 兄弟节点可以互相沟通
- 但“父亲那一层的平级扩散”必须由父亲来做

## `CMP` 的五个 agent

当前建议固定为：

1. `ICMA`
   - 输入内容管理 agent
2. `Iterator Agent`
   - git 工作流推进 agent
3. `Checker Agent`
   - 历史/状态检查 agent
4. `DBAgent`
   - 数据库投影 agent
5. `Dispatcher Agent`
   - 上下文回填与派发 agent

## 为什么要拆成四个指导性部分

`CMP` 的代码量和协议面都会很大。

如果不先把能力拆开，后面会非常容易出现：

- interface 写到一半才发现 git contract 不稳
- git 工作流写完才发现 DB 投影层职责不清
- MQ 广播和 lineage 治理冲突
- active / passive 两套运行流互相打架

所以这轮先固定：

### Part 1

- `CMP` 与 `core_agent` 的特化 interface
- canonical object model

### Part 2

- 项目级 `git repo`
- lineage branch 规则
- sync / PR / merge / promotion 治理

### Part 3

- `CMP DB`
- MQ 邻接广播
- DB projection / visibility / promotion contract

### Part 4

- 五 agent 运行拓扑
- active / passive flow
- 主 agent / 子 agent 上下文回填与播种

## 这四部分的对应文档

- Part 1:
  - [30-cmp-core-interface-and-canonical-object-model.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/30-cmp-core-interface-and-canonical-object-model.md)
- Part 2:
  - [31-cmp-git-lineage-repo-and-sync-governance.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md)
- Part 3:
  - [32-cmp-db-projection-and-neighborhood-broadcast-contract.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md)
- Part 4:
  - [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)

## 当前不要做错的事

- 不要把 `CMP` 退化成一个“查历史时才会用”的被动模块。
- 不要把 `CMP DB` 当成另一个偷偷存真相的影子历史库。
- 不要把 `MQ` 做成任何节点都能全量订阅的全局广播。
- 不要让 `checker` 和 `DBAgent` 抢职责。
- 不要把 `CMP` 的主动上下文干预写成“模糊总结 + embedding 找回”。
- 不要提前把 `CMP` 和 `MP` 混成一个大一统 memory system。

## 当前最重要的边界

- `CMP` 不是 `TAP` 的复制品。
- `CMP` 可以复用 `TAP` 的 control-plane discipline，但不能继承 `capability` 语义。
- `CMP` 的 canonical source 是 `git`。
- `CMP` 的 DB 只做投影、缩影、交付，不做私藏历史。
- `CMP` 的广播与同步必须遵守逐级治理和邻接传播。

