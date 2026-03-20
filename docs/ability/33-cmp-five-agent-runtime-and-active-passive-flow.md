# CMP Five-Agent Runtime And Active Passive Flow

状态：指导性分册，不是冻结实现。

更新时间：2026-03-20

## 这份文档要回答什么

在 `CMP` 里，真正执行治理逻辑的是 5 个 agent。

如果不先讲清楚：

- 谁负责什么
- 主动模式怎么跑
- 被动模式怎么跑
- 主 agent 和子 agent 怎么互相播种上下文

那后面的代码很容易变成“大家都在碰上下文，但没人对最终信噪比负责”。

## 先说结论

`CMP` 当前建议固定为 5 个 agent：

1. `ICMA`
2. `Iterator Agent`
3. `Checker Agent`
4. `DBAgent`
5. `Dispatcher Agent`

它们共同形成：

- 一个主动上下文治理链
- 一个被动历史查询链
- 一个父子 agent 上下文播种链

## 五个 agent 的职责

### 1. `ICMA`

全称：

- 输入内容管理 agent

职责：

- 直接介入 `core_agent` 的上下文输入与运行历史截获
- 作为 `CMP` 的 ingress controller
- 决定当前应该向 `CMP` 送什么粒度的上下文材料

它不应该做：

- 最终的历史裁决
- 最终的 DB projection 产出
- 最终的跨层 promotion

### 2. `Iterator Agent`

职责：

- 负责把上下文变化推进成 `git` 工作流
- 管理 `cmp/*` 线上的 commit / PR / merge / ref 更新

它更像：

- 上下文版的 giter

### 3. `Checker Agent`

职责：

- 维护 git 侧状态可用性
- 甄选最新、可用、可信的 checked state
- 控制哪些状态可以 promotion

一句白话：

- checker 管的是 git 侧“哪一版现在能信”

### 4. `DBAgent`

职责：

- 把 checked state 变成结构化 projection
- 维持 DB 实时性
- 维持高信噪比
- 产出 context package / skill / 状态缩影

一句白话：

- dbagent 管的是 DB 侧“怎么让别人直接吃”

### 5. `Dispatcher Agent`

职责：

- 把高信噪比 context package 回填给主 agent
- 把按任务裁好的上下文种子播给直属子 agent
- 维护上下文交付链路的确认与回执

## 主动模式 canonical flow

当前建议按下面这条主链来理解：

1. `core_agent` 运行
2. `ICMA` 截获：
   - system / assistant / context 变化
   - 新产生的运行历史
3. `ICMA` 生成 `ContextEvent`
4. `Iterator` 把变化推进到 `cmp/<agent-id>` 的 git 线
5. `Checker` 甄选出最新可用的 `CheckedSnapshot`
6. `DBAgent` 把它投影成：
   - `PromotedProjection`
   - `ContextPackage`
7. `Dispatcher` 把 package：
   - 回填给主 agent
   - 或播给直属子 agent 的 `ICMA`

一句白话：

- 先截
- 再 git 化
- 再检查
- 再投影
- 再分发回去

## 被动模式 canonical flow

被动模式下，主 agent 不再要求 `CMP` 主动持续更新，而是按需索取。

当前建议流程：

1. 主 agent 发起 `request_historical_context`
2. `CMP` 定位当前 lineage 的最新 `CheckedSnapshot`
3. `DBAgent` 选择合适 projection
4. materialize 一个高信噪比 `ContextPackage`
5. `Dispatcher` 把结果回填给主 agent

## 父子 agent 播种流程

这是 `CMP` 的第二条关键运行流。

### 父节点向子节点播种

1. 主 agent 决定派生一个子 agent
2. 父节点 `Dispatcher` 按子任务语义裁出高信噪比 `ContextPackage`
3. 该 package 被送到子节点的 `ICMA`
4. 子节点以此作为启动上下文种子

### 子节点向父节点回流

1. 子节点 `ICMA` 截获本地运行历史
2. 经 `Iterator -> Checker -> DBAgent` 处理
3. 子节点只向直属父节点提交提升申请
4. 父节点决定：
   - 接住
   - promotion
   - 是否横向/向上继续扩散

## 同级交换流程

同级节点可以交换信息，但不应绕开父节点的噪声治理责任。

当前建议：

- 同级广播应限制在必要信息
- 不把同级交换自动视为 promotion
- 如果某条同级交换值得上升到更高层，仍由各自父节点后续决定

## 为什么 dispatcher 很关键

如果没有 dispatcher：

- 主 agent 会重新吃到一大堆未经筛选的 raw history
- 子 agent 会拿到过量背景和过量噪音
- 高信噪比设计会在最后一公里失效

所以 dispatcher 不是一个附属件，而是：

- 主 agent 回填器
- 子 agent 播种器
- lineage-aware 路由器

## `CMP` 与 `core_agent` 的关系

当前建议：

- `core_agent` 决定广播内容粒度
- `CMP` 决定这些内容如何被接住、沉淀、筛选、投影和回填

也就是说：

- `core_agent` 更理解任务语义
- `CMP` 更理解上下文治理纪律

## 当前不要做错的事

- 不要让 `ICMA` 变成一个包办一切的超级大脑。
- 不要让 `Iterator` 抢 checker 的状态裁决职责。
- 不要让 `DBAgent` 去决定哪段 git 历史是真的。
- 不要让 `Dispatcher` 变成任意广播器。
- 不要把主动模式和被动模式做成两套完全割裂系统。

