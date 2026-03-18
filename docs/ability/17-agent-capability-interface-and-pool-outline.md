# Agent Capability Interface And Pool Outline

状态：指导性总纲，不是冻结实现。

更新时间：2026-03-18

## 这份文档要回答什么

Praxis 现在已经有了第一个可运行的 `agent_core` raw runtime kernel。

下一步我们不该直接把更多能力硬塞进 `agent_core`，而是要先把下面这件事说清楚：

1. `agent_core` 应该通过什么统一接口调用工具/能力。
2. 这个接口怎样既真实存在，又不污染 `agent_core` 的热路径。
3. 未来的工具/能力池应该怎么组织，才能支持：
   - 高性能调用
   - 热插拔
   - 分层演化
   - 多 provider / 多 runtime 下沉

一句白话：

- `agent_core` 负责推进 agent
- 能力接口负责把“我要做什么”说成统一语言
- 能力池负责把“谁来做、能不能做、怎么快点做”处理掉

## 先说结论

- 我们应该先冻结 `Capability Interface`，再实现 `Capability Pool`。
- `agent_core` 不应该直接理解 `skill`、`mcp`、`websearch`、provider payload 这些厚对象。
- `agent_core` 在热路径里只应该接触：
  - `capability key`
  - `invocation plan`
  - `execution handle`
  - `result envelope`
  - `backpressure signal`
- 统一接口必须分层：
  - `kernel-facing`
  - `pool-facing`
  - `provider-facing`
- 热插拔必须成立，但热插拔逻辑不应该进入 `agent_core` 主 loop，而应放在 pool 的 registry / lease / generation 管理中。
- 池子的第一版不是服务网格，不是治理中心，不是插件市场。
- 第一版池子只做三件事：
  - 能力注册与发现
  - 调用计划批准与派发
  - 执行结果回传与负载控制

## 当前事实基线

按当前仓库事实，Praxis 已存在的能力面大致分成两层。

还有一个必须先说清楚的事实：

- `src/rax/registry.ts` 里的能力词表，不等于当前 `src/rax/facade.ts` 已接线的 public surface。
- 后续做接口和拆任务时，必须始终区分：
  - `capability catalog`
  - `public wired surface`

### 1. 已有真实 runtime 的能力

- `model_inference`
  - 当前在 `agent_core` 中仍是特判执行路径
- `search.ground`
  - 当前通过 `agent_core -> rax` bridge 跑通
- `mcp`
  - 当前已有 shared runtime 与 native prepare/build/compose/execute 分层
- `skill`
  - 当前已有 load / define / bind / activate / use / mount / managed lifecycle 等能力

按当前 `RaxFacade`，已接线的 public surface 主要是：

- `generate.create`
- `generate.stream`
- `embed.create`
- `file.upload`
- `batch.submit`
- `websearch.create`
- `websearch.prepare`
- `mcp.shared.*`
- `mcp.native.prepare/build/compose/execute/composeAndExecute/serve`
- 顶层 `mcp.*` 别名
- `skill.loadLocal/define/containerCreate/discover/bind/activate/prepare/mount/compose/use`
- `skill.list/get/getContent/publish/remove/listVersions/getVersion/getVersionContent/publishVersion/removeVersion/setDefaultVersion`

### 2. 已进入 registry 词表，但还不是当前主闭环的能力簇

- `generate.*`
- `embed.*`
- `tool.*`
- `code.*`
- `computer.*`
- `shell.*`
- `session.*`
- `agent.*`
- `file.*`
- `batch.*`
- `trace.*`

其中当前“定义了词表但还不是 facade 直接入口”的代表能力有：

- `generate.live`
- `generate.structure`
- `search.web`
- `search.fetch`
- `code.*`
- `computer.*`
- `shell.*`
- `session.*`
- `agent.*`
- `trace.*`
- `file.list/read/remove`
- `batch.status/cancel/result`

这说明一件很重要的事：

- Praxis 已经不是“没有能力”
- Praxis 现在缺的是“统一能力接缝”

## 为什么要先做接口，再做池

如果现在直接做池，而接口没有冻结，后面会出现四类问题：

1. `agent_core` 被迫知道越来越多 provider 细节。
2. `skill` / `mcp` / `websearch` 的调用形状互相打架。
3. 热插拔会变成运行时到处判断，而不是 registry 的清晰责任。
4. 池子会退化成一个巨大的 if-else 路由器。

所以更稳的顺序是：

1. 先冻结统一接口和层级边界
2. 再实现能力池
3. 再让已有能力逐条接到池上
4. 最后才做更复杂的治理、包装机和多池体系

## 总设计原则

### 1. 公共语言在上，provider lowering 在下

统一接口不能直接等于 OpenAI / Anthropic / Google 任一家 SDK 的原生对象。

更稳的做法是：

- 上层只说：
  - 我想调哪个能力
  - 输入是什么
  - 运行约束是什么
  - 结果要怎么接
- 下层再决定：
  - 用哪个 provider / layer / variant
  - lower 到哪种 carrier
  - 怎么执行

当前最适合下沉成公共语言基元的，是已有 `rax` 契约中的这些形状：

- `CapabilityKey`
- `CapabilityRequest`
- `PreparedInvocation`
- `CapabilityResult`

但 `agent_core` 不应直接吞入它们的全部字段，而应只保留：

- `capability key`
- `operation`
- `input`
- `result status`
- `artifacts / evidence / error`

不应继续向上泄漏：

- `adapterId`
- `sdk.packageName`
- `sdk.entrypoint`
- `officialCarrier`
- `providerOptions`
- 各家 beta/header/transport 细节

### 2. 冷路径丰富，热路径极薄

接口必须真实存在，但 `agent_core` 的调用热路径必须尽量短。

所以必须做冷热分离：

- 冷路径负责：
  - 注册
  - schema
  - 兼容矩阵
  - 版本
  - 健康检查
  - 热插拔
  - policy tag
- 热路径只负责：
  - acquire / lease
  - prepared plan
  - dispatch
  - result

### 3. 统一接口不等于统一执行器

统一接口是“统一调用语言”，不是“所有能力都用一种内部实现”。

例如：

- `mcp` 可能是长连接 runtime
- `skill` 可能是能力包挂载
- `websearch` 可能是 provider-native 一次性调用
- `model_inference` 可能是主推理面

它们内部形状不同，但对 `agent_core` 的接缝应尽量一致。

### 4. 池负责批准和派发，kernel 不负责发现和挑选

用户已经给了很明确的方向：

- 调用应该像“在池里申请”
- 池给出简单批准
- agent 无痛调用

因此：

- `agent_core` 发出能力调用意图
- pool 负责：
  - 解析 capability key
  - 选定 generation / adapter
  - 产出 lease / execution plan
  - 决定是否排队 / 限流 / 回压
- `agent_core` 不负责能力发现与热插拔判断

### 5. 结果必须统一成证据壳，而不是 SDK 原生返回

统一接口必须给 `agent_core` 标准结果壳：

- `status`
- `output`
- `artifacts`
- `evidence`
- `error`
- `metadata`

不允许 `agent_core` 直接依赖：

- SDK 原生 client object
- provider-specific response body
- beta header 细节
- transport handle

## 边界切分

### `agent_core` 负责什么

- 根据 `GoalFrame + State + Event` 决定下一步
- 发出 `model_inference` 或 `capability_call` 一类运行意图
- 接收统一结果事件
- 推进 run 状态
- 写 journal / checkpoint

### `agent_core` 不负责什么

- 不负责 provider 选择细节
- 不负责工具发现
- 不负责热插拔生命周期
- 不负责能力健康检查
- 不负责 registry 管理
- 不负责兼容矩阵求值

### `Capability Pool` 负责什么

- 注册能力
- 发布能力 manifest
- 管理 generation / version / lifecycle
- 按 route / capability / policy 选择 adapter
- 产生 lease / prepared plan
- 排队、限流、回压
- 汇总执行结果

### `Capability Adapter` 负责什么

- 把统一 invocation lower 到具体 runtime / provider
- 执行
- 映射结果
- 映射错误
- 暴露健康状态

### 治理层不负责什么

治理层以后当然可以套在池子上，但当前阶段不应侵入 raw 接口本体。

第一版不把这些塞进接口规范主干：

- approval workflow
- sandbox approval UI
- long-term policy engine
- packaging engine
- topology assembler
- callback/plugin governance

## 分层架构

当前建议固定为 3 层主接口，加 2 层外围支撑。

### 1. `kernel-facing`

这是 `agent_core` 唯一应该直接依赖的能力调用面。

它的职责：

- 提交调用计划
- 获取执行句柄
- 接收统一结果
- 接收回压信号
- 发起取消

它不暴露：

- provider
- SDK layer
- 原生 payload
- adapter 内部对象

### 2. `pool-facing`

这是能力池内部统一管理面。

它的职责：

- 注册 / 注销 / 替换能力
- 按 manifest 发现能力
- 按 generation 发租约
- prepare / dispatch / cancel
- 维护 queue / backpressure / cache / stats

### 3. `provider-facing`

这是具体实现层。

它的职责：

- supports
- prepare
- execute
- cancel
- healthCheck
- mapError

它可以接：

- `rax.websearch`
- `rax.mcp`
- `rax.skill`
- OpenAI-compatible model executor
- 未来更多 provider-native runtime

### 4. `evidence-facing`

这是结果统一层。

它的职责：

- 把 provider 原始结果统一成标准 `CapabilityResultEnvelope`
- 保留 artifact / evidence / citation / usage 等派生信息

### 5. `governance-facing`

这是未来上层包装机和治理层的挂点。

它的职责不是执行，而是：

- capability filtering
- approval policy
- permission profile
- audit / ledger
- route hints

## 推荐的核心对象

为了避免池子一上来变成大杂烩，建议把“统一能力接口”先拆成下面 8 个对象。

### 1. `CapabilityManifest`

作用：

- 描述一个能力是什么

建议至少包含：

- `capabilityId`
- `capabilityKey`
- `kind`
  - `model`
  - `tool`
  - `resource`
  - `runtime`
- `version`
- `generation`
- `description`
- `inputSchemaRef`
- `outputSchemaRef`
- `supportsStreaming`
- `supportsCancellation`
- `supportsPrepare`
- `hotPath`
  - 是否允许进入高性能直达路径
- `routeHints`
- `tags`
- `metadata`

白话：

- 这是“能力名片”
- 不是热路径对象

### 2. `CapabilityBinding`

作用：

- 表示某个 manifest 当前绑定到哪个 adapter/runtime/provider

建议至少包含：

- `bindingId`
- `capabilityId`
- `generation`
- `adapterId`
- `runtimeKind`
- `routeProfile`
- `state`
  - `active`
  - `draining`
  - `disabled`
- `priorityClass`

白话：

- 同一个能力可以换后端
- binding 是“现在谁在接这个活”

### 3. `CapabilityLease`

作用：

- 池对一次调用的快速批准结果

建议至少包含：

- `leaseId`
- `capabilityId`
- `bindingId`
- `generation`
- `grantedAt`
- `expiresAt`
- `priority`
- `queueClass`
- `backpressureSnapshot`
- `preparedCacheKey?`

白话：

- 这是“批准条”
- 热路径真正该拿到的是它，而不是整份 manifest

### 4. `CapabilityInvocationPlan`

作用：

- kernel 提交给 pool 的统一调用请求

建议至少包含：

- `planId`
- `intentId`
- `sessionId`
- `runId`
- `capabilityKey`
- `operation`
- `input`
- `timeoutMs`
- `idempotencyKey`
- `priority`
- `traceContext`
- `metadata`

白话：

- 这是“我要做这件事”的统一说法

### 5. `PreparedCapabilityCall`

作用：

- pool/adapter 为执行准备好的调用计划

建议至少包含：

- `preparedId`
- `leaseId`
- `capabilityKey`
- `bindingId`
- `generation`
- `preparedPayloadRef`
- `executionMode`
  - `direct`
  - `queued`
  - `streaming`
  - `long-running`
- `cacheKey`

白话：

- 这是热路径真正可执行的“压缩调用包”

### 6. `CapabilityExecutionHandle`

作用：

- 表示一次已派发执行的运行句柄

建议至少包含：

- `executionId`
- `preparedId`
- `startedAt`
- `state`
  - `queued`
  - `running`
  - `completed`
  - `failed`
  - `cancelled`
- `cancelTokenRef?`
- `streamRef?`

### 7. `CapabilityResultEnvelope`

作用：

- 统一返回结果壳

建议至少包含：

- `executionId`
- `resultId`
- `status`
- `output`
- `artifacts`
- `evidence`
- `error`
- `usage`
- `completedAt`
- `metadata`

### 8. `CapabilityBackpressureSignal`

作用：

- 让 pool 对 kernel 发负载反馈

建议至少包含：

- `source`
  - `global`
  - `binding`
  - `provider`
- `queueDepth`
- `inflight`
- `reason`
- `suggestedAction`
  - `wait`
  - `retry-later`
  - `degrade`
  - `switch-binding`
- `emittedAt`

## 三层接口草图

下面不是最终 TS 定义，而是建议的接口轮廓。

### `kernel-facing`

```ts
interface KernelCapabilityGateway {
  acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease>;
  dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle>;
  prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall>;
  cancel(executionId: string): Promise<void>;
  onResult(listener: (result: CapabilityResultEnvelope) => void): () => void;
  onBackpressure(listener: (signal: CapabilityBackpressureSignal) => void): () => void;
}
```

约束：

- `agent_core` 只看见这个层面
- 不看见 provider
- 不看见 SDK payload

### `pool-facing`

```ts
interface CapabilityPool {
  register(manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding;
  unregister(bindingId: string): void;
  replace(bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter): CapabilityBinding;
  suspend(bindingId: string): void;
  resume(bindingId: string): void;
  listCapabilities(): readonly CapabilityManifest[];
  listBindings(): readonly CapabilityBinding[];
  acquire(plan: CapabilityInvocationPlan): Promise<CapabilityLease>;
  prepare(lease: CapabilityLease, plan: CapabilityInvocationPlan): Promise<PreparedCapabilityCall>;
  dispatch(prepared: PreparedCapabilityCall): Promise<CapabilityExecutionHandle>;
  cancel(executionId: string): Promise<void>;
  health(bindingId?: string): Promise<unknown>;
  stats(): unknown;
}
```

约束：

- registry / scheduler / execution 可以是内部拆分实现
- 但对外统一由 pool 挂出

### `provider-facing`

```ts
interface CapabilityAdapter {
  supports(plan: CapabilityInvocationPlan): boolean;
  prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall>;
  execute(prepared: PreparedCapabilityCall): Promise<CapabilityResultEnvelope>;
  cancel?(executionId: string): Promise<void>;
  healthCheck?(): Promise<unknown>;
}
```

约束：

- provider 特有复杂度止于这一层

## 高频调用路径

为了满足“agent 无痛用工具/能力”，热路径建议固定成 6 步：

1. `agent_core` 根据状态机决定发起 `capability_call`
2. 生成 `CapabilityInvocationPlan`
3. pool `acquire`
   - 只做快速批准
   - 绑定到具体 generation / adapter
4. pool `prepare`
   - 命中 prepared cache 则直接复用
5. pool `dispatch`
   - 进入 queue 或直达执行
6. 结果统一回写为 `CapabilityResultEnvelope`，再映射回 kernel event

一句白话：

- `agent_core` 不问“谁来做”
- 只问“这个 plan 准了吗，跑了吗，结果回来了没”

## 热插拔设计

热插拔不是“随时替换 handler 然后希望别出事”，而应该是 generation 驱动。

建议原则：

### 1. `register` 不覆盖旧 generation

- 新注册产生新 generation
- 旧 generation 进入 `draining`
- 新调用只走新 generation
- 老 inflight 正常跑完

### 2. `unregister` 是两阶段

- 第一阶段：停止新租约
- 第二阶段：等待 inflight drain
- drain 完成后再真正摘除

### 3. `replace` 等于 `register + drain-old`

不要做原地热替换引用。

### 4. manifest 与 binding 分离

- manifest 表示能力定义
- binding 表示当前执行面

这样未来一个能力可以：

- 多 binding
- 多 runtime
- 多 provider route
- 多版本并存

## 高性能池设计预览

当前我们先不把池子实现完，但性能原则必须先写死。

### 1. `hot/cold split`

冷数据：

- manifest
- schema
- notes
- compatibility matrix
- lifecycle metadata

热数据：

- binding hot table
- queue heads
- inflight table
- prepared cache index
- backpressure counters

### 2. `generation-indexed fast lookup`

建议 hot lookup key 至少是：

- `capabilityKey`
- `route bucket`
- `generation`

不要每次调用都全表扫描 manifest。

### 3. `prepare cache`

适合缓存的只有两类：

- prepared invocation
- 幂等只读结果

不缓存：

- agent 最终判断
- 带副作用结果
- 无法验证的远端状态

### 4. `multi-queue`

池子不应只有一个全局大队列。

第一版建议至少有：

- global queue
- per-binding queue
- per-provider inflight counters

这样后面才能做：

- 回压
- 局部熔断
- binding 降级

### 5. `result streaming ready`

虽然第一版可以先只收最终结果，但接口必须预留：

- partial result
- stream chunk
- progress event
- cancel

否则未来一接长任务或流式能力就要重写协议。

## 当前不该做的事

以下内容这次不要混进第一版接口规范：

- 把 pool 做成完整插件市场
- 把 provider 发现逻辑塞进 kernel
- 在 kernel 内直接处理 `skill` / `mcp` / `websearch` 的原生对象
- 做复杂的分布式调度
- 做多租户权限平台
- 做 UI approval 工作流
- 做跨池编排
- 做 speculative execution

## 当前推荐的能力分类

### 第一层：`Kernel`

- `AgentSession`
- `AgentRun`
- `AgentState`
- `GoalFrame`
- `StepTransition`
- `EventJournal`
- `CheckpointStore`
- `KernelCapabilityGateway`

### 第二层：`Capability Pool`

- `CapabilityManifest`
- `CapabilityBinding`
- `CapabilityLease`
- `CapabilityInvocationPlan`
- `PreparedCapabilityCall`
- `CapabilityExecutionHandle`
- `CapabilityResultEnvelope`
- `CapabilityBackpressureSignal`

### 第三层：`Capability Runtime`

- `model inference adapter`
- `websearch adapter`
- `mcp adapter`
- `skill adapter`
- 后续新增能力 adapter

### 第四层：`Provider Carrier`

- OpenAI
- Anthropic
- DeepMind / Google
- 其他未来 provider / local runtime

### 第五层：`Governance`

- compatibility profile
- policy
- packaging engine
- topology
- context manager
- ledger / audit

## 与当前代码的关系

当前仓库里已经存在几块可以直接继承的基础：

### 可保留

- `event-first`
- `state_delta`
- `AppendOnlyEventJournal`
- `CheckpointStore`
- `queue + idempotency + backpressure`
- `Session hot/cold split`

### 需要提升

- 当前 `CapabilityPortBroker`
  - 需要从“单一 broker”升级为“pool-facing 分层入口”
- 当前 `CapabilityPortDefinition`
  - 需要从 `capabilityKey + handler` 升级到 `manifest + adapter`
- 当前 `model_inference`
  - 不应长期保留 runtime 特判，应回到统一能力面
- 当前 `rax-port`
  - 不应把 provider 细节继续裸露给 kernel-facing 层

## 实现顺序建议

当前建议把后续工程顺序定成下面 8 包，但这份文档先不展开完整 task pack。

1. `Phase 0`
   - 冻结能力接口协议
   - 冻结对象名与事件名

2. `WP-01`
   - `CapabilityManifest / Binding / Lease` 类型冻结

3. `WP-02`
   - `kernel-facing gateway` 抽象落地

4. `WP-03`
   - `pool registry + lifecycle + generation` 落地

5. `WP-04`
   - `prepare / dispatch / cancel / result envelope` 落地

6. `WP-05`
   - `queue / backpressure / cache / stats` 细化

7. `WP-06`
   - `model inference` 接入统一能力面

8. `WP-07`
   - `rax websearch / mcp / skill` 逐条桥接

9. `WP-08`
   - 热插拔与 drain 策略落地

## 这一版总纲的最终判断

这次我们应把下面这句话定死：

- `agent_core` 不直接调用工具/能力实现，它只调用 `KernelCapabilityGateway`。
- `KernelCapabilityGateway` 下面接 `CapabilityPool`。
- `CapabilityPool` 通过 `CapabilityAdapter` 去对接 `rax`、provider runtime 和未来新增能力。

这样做的好处是：

- raw kernel 保持小而硬
- 能力面可以持续增厚
- 热插拔不会污染主 loop
- 后续更多池子和接口也能照这个范式扩展

一句压缩版：

- 接口先统一
- 池子后实现
- 热路径只认 plan / lease / result
- 冷路径承载 schema / registry / lifecycle / hot-swap
