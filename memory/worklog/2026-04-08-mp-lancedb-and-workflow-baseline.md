# 2026-04-08 MP LanceDB And Workflow Baseline

## 这轮工作的结论

这轮最重要的新结论不是继续扩 `CMP`，而是把 `MP` 从“预留位”推进到了真实可用层。

当前最重要的结果是：

- `MP` 已经有了真实的 `LanceDB` storage plane
- `rax.mp` 已经形成
- `mp.*` capability family 已经形成
- 并且 `MP` 已默认接入 `AgentCoreRuntime` 的 workflow

一句白话：

- 现在不是“以后再做 MP”
- 而是“MP 已经开始具备真实运行能力”

## 这轮真正落下来的东西

### 一、`MP` 的核心模块已经成形

当前已经新增：

- `src/agent_core/mp-types/**`
- `src/agent_core/mp-lancedb/**`
- `src/agent_core/mp-runtime/**`
- `src/rax/mp-types.ts`
- `src/rax/mp-config.ts`
- `src/rax/mp-connectors.ts`
- `src/rax/mp-runtime.ts`
- `src/rax/mp-facade.ts`

白话：

- `MP` 不再只是 branch family 中的一个名字
- 现在已经有独立的类型层、落盘层、runtime 层和 facade 层

### 二、`MP` 的 storage plane 当前已经固定为 `LanceDB`

这轮当前已经形成两层 adapter：

- 真实本地 `LanceDB` adapter
- in-memory fallback adapter

当前真实本地 adapter 已支持：

- bootstrap
- upsert
- get
- update
- archive
- search

实现策略当前不是直接把复杂对象结构硬塞进 `Arrow` 嵌套 schema，而是：

- 把 `MpMemoryRecord` 降成稳定的行模型
- 数组与对象字段先走 JSON 字符串列

一句白话：

- 这套实现优先保证“本地能真实落盘、能真实回读、能稳定扩”
- 不追求第一版就在 `Arrow` schema 上做复杂花活

### 三、`MP` 的当前默认治理语义已经落地

当前已经固定并通过测试的主要语义包括：

- scope:
  - `agent_isolated`
  - `project`
  - `global`
- session mode:
  - `isolated`
  - `bridged`
  - `shared`
- search planner
- scope enforcement
- session bridge access
- `split`
- `merge`
- `reindex`
- `compact`
- `archive`

白话：

- `MP` 现在已经不是简单“向量表 + 检索”
- 而是已经具备一层受治理的 memory workflow

### 四、`MP` capability family 当前已经形成

当前 `mp.*` family 已包括：

- `mp.search`
- `mp.materialize`
- `mp.promote`
- `mp.archive`
- `mp.split`
- `mp.merge`
- `mp.reindex`
- `mp.compact`

并且已经接好：

- capability package
- activation factory
- `rax-mp` capability adapter
- TAP formal family assembly
- formal family inventory
- family check

### 五、`MP` 当前已经默认接入 `AgentCoreRuntime`

当前 `createAgentCoreRuntime()` 默认就会注册：

- `mp.search`
- `mp.materialize`
- `mp.promote`
- `mp.archive`
- `mp.split`
- `mp.merge`
- `mp.reindex`
- `mp.compact`

同时保留一个显式关闭口：

- `registerDefaultMpCapabilityFamily: false`

一句白话：

- `MP` 现在不是旁路能力
- 已经进入默认 workflow 主链

## 这轮新增的主链验证

### 一、真实本地 `LanceDB` 回路

当前已经验证：

- bootstrap 本地 Lance 目录
- createEmptyTable
- add
- get
- search

### 二、`rax.mp` 最小运行壳

当前已经验证：

- create session
- bootstrap
- materialize
- search
- promote
- archive
- split
- merge
- reindex
- compact

### 三、默认 workflow 场景

当前已经新增并通过：

- `mp.materialize -> rax.mp.search`
- `mp.promote -> parent visibility change`
- `mp.archive -> search disappear`
- `mp.search` 通过 package-backed activation materialization 进入 `dispatchCapabilityIntentViaTaPool`

## 这轮最重要的工程判断

当前最重要的新判断是：

- `MP` 的当前实现已经足以作为后续继续开发的正式起点

也就是说：

- 后面继续做 `LanceDB` 分层记忆、跨 session 联通、以及更高层 MP workflow
- 默认直接在这条总装线继续写

## 当前还没做但要记住的边界

### 1. 现在的 `MP` family 已完整进入 workflow，但还没有把所有产品入口做成用户级 CLI/smoke

白话：

- capability layer 已经接好了
- 但更外层的产品入口还可以继续补

### 2. 真实 `LanceDB` adapter 当前优先保证稳定落盘与稳定查询，不追求第一版极限 schema 精细化

白话：

- 现在先要“可靠”
- 不是先要“最优雅的向量列工程”

## 给后续 Codex 的一句提示

如果后续 Codex 读到这份文件，默认把 `MP` 理解成：

- “现在已经有真实 `LanceDB` storage plane、默认 workflow、以及完整 capability family 的正式子系统”

而不是：

- 仍只是 branch family 里的预留概念
