# 2026-04-09 MP Five-Agent Memory Workflow

## 这轮工作的核心结论

这轮最重要的变化，不是继续给 `MP` 补更多底层原子操作，而是把它从：

- “LanceDB 存取与检索能力集合”

推进成：

- “以记忆化为主线的五代理工作流”

一句白话：

- `MP` 现在不再只是一个能写库、能搜库的 memory adapter
- 它开始具备和 `CMP` 同等级的 workflow 形态，只是后端真值面固定为 `LanceDB`

## 当前已经固定下来的产品形态

### 一、`MP` 的主入口现在应该按 workflow 来理解

当前保留下来的 `mp.search / materialize / promote / archive / split / merge / reindex / compact` 仍然可用，但角色已经变化：

- 它们是 workflow 内部工具层
- 也是兼容层
- 不再是 `MP` 产品语义的全部

更高层、面向使用者的主入口现在是：

- `rax.mp.ingest(...)`
- `rax.mp.align(...)`
- `rax.mp.resolve(...)`
- `rax.mp.requestHistory(...)`
- `rax.mp.readback(...)`
- `rax.mp.smoke(...)`

白话：

- 默认使用者以后应该先看 workflow 面
- 而不是把 `MP` 理解成一堆裸 CRUD 能力

### 二、`MP` 当前固定为五代理，不扩成更多角色

当前角色固定为：

- `icma`
- `iterator`
- `checker`
- `dbagent`
- `dispatcher`

职责边界也已经固定：

- `icma`
  负责摄取、切块、边界控制
- `iterator`
  负责把原始片段重写成更稳定的候选记忆草案
- `checker`
  负责去噪、去重、时效判断、覆盖判断，是提升信噪比的主角色
- `dbagent`
  是唯一主写角色，负责把最终变更落到 `LanceDB`
- `dispatcher`
  负责检索结果重排、bundle 组装、回流路由和解释面

默认治理语义：

- 只有 `dbagent` 能做主写
- 只有 `dispatcher` 能决定主 bundle 组成
- `checker` 只能提出 `stale / superseded / merge / split / archive` 决策，不直接写库

### 三、`MP` 的高信噪比现在来自 workflow，而不是只靠向量检索

这轮已经明确一个长期约束：

- `MP` 的质量不靠“搜得更多”
- 而靠“角色分工 + freshness/alignment/supersede 规则 + dispatcher 重排”

当前默认排序和过滤方向是：

- 优先 `fresh`
- 优先 `aligned`
- 默认把 `superseded` 记录从主结果里剔掉
- `stale` 可以作为补充返回，但不能压过 fresh 主结果

白话：

- 同主题下有新旧两条记忆时
- 系统会尽量把新、对齐过、未被覆盖的记录推到前面

## 当前已经固定下来的数据模型约束

`MpMemoryRecord` 现在不再只是内容和 embedding 的壳，还带有记忆治理字段：

- `sourceRefs`
- `memoryKind`
- `observedAt`
- `capturedAt`
- `freshness`
- `confidence`
- `supersedes`
- `supersededBy`
- `alignment`

其中最重要的新判断是：

- “最新动态对齐”已经是 `MP` 数据模型内建的一等能力
- 不是调用方自己在外面手拼

这意味着后续继续扩 `MP` 时，默认要沿着这些字段做：

- freshness policy
- alignment policy
- supersede chain
- retrieval rerank

而不是绕开这些字段再做第二套外置规则

## 当前已经固定下来的 runtime 和 TAP 事实

这轮之后，默认 runtime 侧不再只注册底层 `mp.*` 原子能力，还已经补入 workflow 级能力：

- `mp.ingest`
- `mp.align`
- `mp.resolve`
- `mp.history.request`

白话：

- `AgentCoreRuntime` 看到的 `MP`
- 现在已经不是“只有物化和搜索”
- 而是一个有主动流程、被动流程和对齐流程的 workflow 子系统

## 当前测试层面已经覆盖到的重点

这轮新增或补强的重点覆盖包括：

- five-agent 配置目录与 capability matrix
- workflow summary / readback / smoke
- ingest -> checker -> dbagent -> dispatcher 的主动流程
- alignment 后旧记录降级、新记录前置
- retrieval 的 freshness/alignment/supersede 重排
- `rax.mp` workflow 入口
- TAP 通过 `mp.ingest` 触发 workflow

## 给后续 Codex 的一句话提示

如果后续有人继续在这条线上开发，默认把 `MP` 理解成：

- “一个以 `LanceDB` 为真值面、以 five-agent workflow 为主入口、以内建 freshness/alignment/supersede 规则提升信噪比的 memory subsystem”

而不要再把它只理解成：

- “一个能 materialize 和 search 的向量库封装”
