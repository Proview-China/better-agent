# Agent Core Runtime Kernel Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-17

## 这份文档要回答什么

在 Praxis 当前阶段，我们已经有不少能力块：

- 薄能力 adapter
- `mcp` runtime
- `websearch` runtime
- `skill` runtime

但这些还不等于一个真正最小的 agent。

所以这份文档先不讨论治理层，不讨论多 agent 拓扑，也不讨论复杂的包装机装载策略，而是只回答三个更基础的问题：

1. 什么叫 Praxis 的最小 raw agent runtime kernel。
2. 一个最小 agent 到底必须具备哪些对象和运行语义。
3. kernel 和能力块、治理层之间的边界应该怎么切。

## 先说结论

- Praxis 现在应该先建立 `raw runtime kernel`，再往外叠治理层。
- 这个 kernel 不只要“能跑”，还要优先为高密度、高性能、可恢复运行做结构准备。
- `agent_core` 的第一版不应该先等于：
  - `Context Manager`
  - `Packaging Engine`
  - `Policy Engine`
  - `Topology Assembler`
- `agent_core` 的第一版应该只负责：
  - 维持 agent 的持续身份
  - 维持单次运行的推进状态
  - 根据目标、状态和观察结果决定下一步
  - 通过统一插槽调用外部能力块
  - 记录事件与快照，支持暂停、恢复和继续推进

一句白话：

- 能力块负责“具体干活”
- kernel 负责“让 agent 活着并持续推进”
- 治理层负责“约束 agent 怎么活、活到哪里停”

## 性能优先的 kernel 原则

当前建议把 kernel 的性能方向也先写死，不要等实现时再临时拼：

1. `event-first`
- 事实源优先写事件，不优先改写大对象。

2. `delta-state`
- 状态尽量按增量更新，不做全量重写。

3. `queued-port`
- 外部能力调用统一先进队列，再由 port 调度执行。

4. `tiered-checkpoint`
- 高频轻快照和低频持久快照分层。

5. `hot/cold split`
- 热状态和冷历史分离，恢复时优先只读热数据。

一句白话：

- 热路径尽量短
- 冷数据尽量外置
- 大对象尽量不搬
- 事实先落事件
- 恢复优先靠指针和增量，而不是每次重算一切

## 为什么现在先做 raw kernel

当前仓库已经有较完整的能力控制面和若干能力块 runtime。

如果此时直接把复杂治理、包装机、上下文注入、审批策略全部塞进 `agent_core`，会出现两个问题：

1. kernel 和能力块职责打架
2. 后续能力块升级会反向拖慢核心运行时

所以当前更稳的工程顺序是：

1. 先定最小 raw kernel
2. 再挂治理层
3. 最后再做更复杂的多 agent 拓扑和高密度调度

## 最小 agent 的判定标准

一个系统是否已经可以被叫做“最小 agent”，不看它会多少能力，而看它是否同时满足下面 6 件事：

1. 它有持续身份，而不是一次性函数调用。
2. 它有目标锚点，而不是空转 loop。
3. 它能基于当前状态和观察结果决定下一步，而不是只跑预写死脚本。
4. 它能调用外部能力，而不是只在内部空想。
5. 它能暂停、失败、恢复、继续推进。
6. 它能留下历史与恢复点，而不是每轮都失忆。

只要这 6 条成立，Praxis 就已经拥有一个最小 raw agent。

## 最小运行闭环

当前建议把 kernel 的最小闭环固定成下面这条：

`开始 -> 读取 run/goal/state/checkpoint -> 决定下一步 -> 内部推进或调用 capability -> 收 observation/result -> 写 event -> 更新 state -> 判断结束/暂停/失败 -> 继续下一轮`

这个 loop 里最关键的不是“调用工具”，而是“根据当前目标、状态和观察结果决定下一步”。

如果下一步是预写死的，它更像 workflow runner。
如果下一步是 runtime 在每轮动态决定的，它才开始像 agent。

## kernel 的最小对象集合

当前建议把 kernel 固定为 5 个核心对象，加 3 条必须存在的运行语义。

### 1. `AgentSession`

作用：

- 表示一个 agent 的持续存在。
- 承载跨多次运行共享的身份与恢复边界。

它负责：

- `sessionId`
- 生命周期归属
- 与持久化恢复的长期关联
- 运行集合管理
- 热索引头部：
  - `activeRunId`
  - `lastCheckpointRef`
  - `version`

它不负责：

- 单次运行内部细节
- provider-specific payload
- 能力块内部状态

性能建议：

- `AgentSession` 应采用 `hot header + cold log` 结构：
  - hot header 只放恢复和调度必需索引
  - cold log 放历史事件、旧 run 引用、产物引用
- session 不应变成巨型 JSON blob
- session summary 应视为派生缓存，不是事实源

### 2. `AgentRun`

作用：

- 表示一次具体任务执行。
- 承载当前 loop 的执行上下文和推进位置。

它负责：

- `runId`
- `sessionId`
- 当前状态机位置
- 当前目标引用
- 当前待执行动作
- 当前最后结果

它不负责：

- 长期治理策略全集
- 能力块内部执行细节

性能建议：

- `AgentRun` 应更像单线程调度壳，而不是无约束状态袋子。
- 当前建议至少分出 3 条 lane：
  - `decision lane`
    - 一次只允许一个“决定下一步”的动作在跑
  - `capability lane`
    - 负责外部能力调用
  - `event commit lane`
    - 负责异步写 journal/checkpoint
- 原则是：
  - 决策串行
  - I/O 异步
  - 提交分离

### 3. `AgentState`

作用：

- 表示当前运行时的最小状态本体。
- 应尽量小、尽量可序列化、尽量与能力块内部实现解耦。

它至少要覆盖：

- 当前 `status`
- 当前工作态
- 最近一次 observation/result
- 最近一次错误
- 当前待处理调用
- 最近一个 checkpoint 引用

它不应该承担：

- 全量事件历史正文
- provider SDK 原生对象
- 无界增长的上下文正文

性能建议：

- `AgentState` 应拆成 4 个区：
  - `control`
  - `working`
  - `observed`
  - `recovery`
- 状态更新默认走 `state_delta`
- `derived` 信息例如 summary/cost estimate 应视为可丢弃派生层
- 大 observation 或大 artifact 不直接嵌入 state，只保留引用或摘要

### 4. `CapabilityPort`

作用：

- 作为 kernel 调外部能力块的统一插槽。

它负责：

- 统一调用入口
- 屏蔽能力块内部细节
- 把 kernel 的需求转成标准 capability 请求
- 接收标准结果、产物、证据和提示

它不负责：

- 决定下一步
- 自己维护 agent 生命周期
- 吞并能力块内部 runtime

性能建议：

- `CapabilityPort` 不应只是统一函数签名，而应是带调度能力的 broker。
- 第一版就建议预留：
  - `request queue`
  - `priority`
  - `idempotency key`
  - `dedupe window`
  - `result stream`
  - `backpressure`
- 可以接受的缓存有两类：
  - `prepared invocation cache`
  - 纯读型 `capability result cache`
- port 只缓存安全、可重放、可验证的内容，不缓存 agent 最终结论

### 5. `CheckpointStore`

作用：

- 保存和恢复运行快照。

它负责：

- checkpoint 写入
- checkpoint 读取
- checkpoint 版本引用
- pause/fail/retry/resume 的恢复锚点

它不负责：

- 解释为什么这样恢复
- 重建能力块内部私有句柄

性能建议：

- `CheckpointStore` 采用两层结构：
  - `L1 fast checkpoint`
    - 本地轻量、可高频写
  - `L2 durable checkpoint`
    - 稀疏持久化、关键节点才写
- checkpoint 里不只存 state，还应带：
  - `journal offset`
  - `pending action snapshot`
  - `resume pointer`
  - `input assembly hash`

## kernel 的 3 条必需运行语义

只有对象还不够，kernel 还必须具备下面 3 条活的运行语义。

### 1. `GoalFrame`

作用：

- 定义当前这次运行到底为了什么。

至少应包含：

- 当前目标
- 完成条件
- 失败条件
- 输入锚点

说明：

- `GoalFrame` 可以是 `AgentRun` 内的结构，不一定必须单独做类。
- 但它在概念上必须存在。

性能建议：

- `GoalFrame` 可以内部再分成：
  - `goal source`
  - `goal normalized`
  - `goal compiled`
- 这样后续才容易承接：
  - prompt prefix cache
  - static instruction reuse
  - warm-start assembly

### 2. `StepTransition`

作用：

- 定义每轮 loop 的合法状态推进。

每一轮至少要能回答：

- 下一步是内部推进
- 还是调用某个 capability
- 还是进入等待
- 还是暂停
- 还是结束
- 还是失败

建议第一版最小状态：

- `idle`
- `running`
- `deciding`
- `acting`
- `waiting`
- `paused`
- `completed`
- `failed`
- `cancelled`

性能建议：

- `StepTransition` 应尽量做成表驱动状态机，而不是散落的条件分支。
- 建议每次迁移统一带：
  - `from`
  - `to`
  - `reason`
  - `stateDelta`
  - `nextAction`
  - `eventId`
- 同时区分：
  - `fast path`
    - `deciding -> acting -> deciding`
  - `rare path`
    - `pause/fail/cancel/recover`

### 3. `EventJournal`

作用：

- 记录 agent 是怎么走到当前状态的。

它至少负责：

- 事实事件
- 状态迁移事件
- 能力调用事件
- observation/result 事件
- checkpoint 事件

说明：

- `summary` 可以存在，但它不应该取代事件流。
- `history` 是事实层。
- `summary` 是压缩层。
- `pointer` 是恢复锚点。

性能建议：

- `EventJournal` 应优先采用：
  - append-only
  - immutable event
  - async flush
  - secondary indexes
  - segment compaction
- 当前最重要的索引至少要有：
  - `by runId`
  - `by correlationId`
- journal 是事实源，summary 只是派生物

## kernel 与能力块的边界

当前先把边界定死成下面这组。

### kernel 负责

- `run` 的创建、推进、暂停、恢复、结束
- 目标锚定
- 状态机推进
- 统一 capability 调用入口
- 事件和 checkpoint 记录

### 能力块负责

- 自己的 provider/layer/variant 路由
- 自己的 lowering
- 自己的专门 runtime
- 自己的执行结果和原始证据

### 当前明确不让 kernel 负责的

- 直接拼三家 SDK payload
- 直接持有 provider SDK client
- 重做 `mcp` / `skill` / `websearch` 的执行器
- 重做能力块内部连接管理或 activation 逻辑

一句白话：

- kernel 像操作系统调度器
- 能力块像驱动和子系统

## kernel 与治理层的边界

当前也先把治理层和 kernel 硬切开。

### kernel 内

- 目标
- 状态
- loop
- capability call
- event
- checkpoint

### 治理层外挂

- `Context Manager`
- `Packaging Engine`
- `Policy / Approval`
- `Autonomy Boundary`
- `Topology / Multi-Agent Orchestration`
- `Skill Container` 的复杂装载策略

说明：

- 这些层未来一定重要
- 但它们应建立在 kernel 已稳定的前提上
- 不应反向定义 raw kernel

## 当前建议的高性能实现总图

如果把上述内容压成一张实现导图，当前更稳的版本是：

- `AgentSession`
  - `hot header + cold log`
- `AgentRun`
  - `single decision lane + async execution lanes`
- `AgentState`
  - `small structured state + delta updates`
- `CapabilityPort`
  - `broker + queue + cache + backpressure`
- `CheckpointStore`
  - `fast ring + sparse durable checkpoints`
- `GoalFrame`
  - `normalized + compiled + cacheable`
- `StepTransition`
  - `table-driven FSM + hot path optimization`
- `EventJournal`
  - `append-only event source + indexed replay`

## 与三家官方 agent runtime 的对齐判断

当前内部设计方向与三家官方 agent runtime 的共同模式是对齐的：

- 先有 `run/session/history/tools`
- 再有 `resume/continue/pause`
- 然后再外挂：
  - tracing
  - handoff/subagent
  - memory
  - hooks
  - workflow
  - governance

所以 Praxis 当前的设计收口也应遵守相同顺序：

- 先做最小 raw agent
- 再做厚治理层

而不是反过来。

## 当前可以先冻结的判断

1. `agent_core` 第一版先定义 raw runtime kernel。
2. kernel 的最小对象是：
   - `AgentSession`
   - `AgentRun`
   - `AgentState`
   - `CapabilityPort`
   - `CheckpointStore`
3. kernel 的最小运行语义是：
   - `GoalFrame`
   - `StepTransition`
   - `EventJournal`
4. 一个最小 agent 必须具备：
   - 目标锚定
   - 动态推进
   - 外部作用
   - 历史恢复
5. `summary` 不等于 `history`，只能作为派生压缩层。
6. kernel 的性能设计优先采用：
   - `event-first`
   - `delta-state`
   - `queued-port`
   - `tiered-checkpoint`
   - `hot/cold split`
7. `Context Manager / Packaging Engine / Policy / Topology` 当前不进入 kernel 本体。

## 当前先不要定死的事情

- `AgentSession` 是否一对一绑定单 agent identity，还是未来允许多 persona。
- `AgentRun` 是否只允许单线程推进，还是未来允许一个 run 内部局部并发。
- `CheckpointStore` 是事件溯源优先，还是快照优先。
- `EventJournal` 是否要先区分用户事件、系统事件、能力事件三种通道。
- `GoalFrame` 是否需要天然支持多级子目标。

## 后续细化顺序

在这份总纲之后，后续更稳的细化顺序是：

1. `AgentRun + AgentState + GoalFrame`
2. `StepTransition` 的合法迁移
3. `CapabilityPort` 的请求/响应协议
4. `EventJournal + CheckpointStore`
5. 再展开治理层：
   - topology
   - io
   - ooa
   - autonomy

## 一句话收口

Praxis 的 `agent_core` 第一版，不是“会很多能力的复杂 agent 系统”，而是“一个能持续持有目标、状态、历史和外部作用能力，并可暂停恢复的最小 raw agent kernel”。
