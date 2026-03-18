# Agent Capability Interface Implementation Status

状态：阶段性实现总结，不是最终收口结论。

更新时间：2026-03-18

## 先说结论

`Capability Interface` 这一部分现在已经不是纸面设计了。

它已经完成到下面这个程度：

- 第一版统一接口协议已落地
- 第一版能力池骨架已落地
- 第一批 adapter 已落地
- `AgentCoreRuntime` 已开始接入新的 `KernelCapabilityGateway + CapabilityPool` 路径
- 当前类型检查和测试都已通过

但它**还不能被叫做“完全做完”**。

更准确的判断是：

- 接口第一版已经成立
- 新旧两套路径现在处于并存期
- 还没有完全切掉旧 `CapabilityPortBroker` 主路径
- `runUntilTerminal()` 也还没有完全改到新接口路径上

一句白话：

- 新接口已经建好了，而且已经接上主 runtime 的一部分
- 但系统还没有完成“全量切换”

## 这次到底完成了什么

### 1. 统一协议层

当前已落地：

- `src/agent_core/capability-types/**`

这里已经冻结了第一版统一接口最关键的对象：

- `CapabilityManifest`
- `CapabilityBinding`
- `CapabilityLease`
- `CapabilityInvocationPlan`
- `PreparedCapabilityCall`
- `CapabilityExecutionHandle`
- `CapabilityResultEnvelope`
- `CapabilityBackpressureSignal`
- `CapabilityAdapter`
- `CapabilityPool`
- `KernelCapabilityGateway`

这意味着：

- `agent_core` 面向能力的公共语言已经存在
- 不再只是抽象讨论

### 2. 冷路径模型层

当前已落地：

- `src/agent_core/capability-model/**`

这里已经把两件事正式拆开：

- `manifest`
  - 这个能力是什么
- `binding`
  - 当前谁在接这个活

并补上了：

- generation
- wired surface vs catalog
- hot/cold field 拆分

这意味着：

- 后续热插拔和 registry 已经有数据模型底座

### 3. 热路径调用对象

当前已落地：

- `src/agent_core/capability-invocation/**`

这里已经把热路径对象补齐：

- `plan`
- `lease`
- `prepared`
- `execution handle`

而且已经补了和旧 `CapabilityCallIntent / CapabilityPortRequest` 的映射辅助函数。

这意味着：

- 新接口不是和旧系统完全断裂的
- 它已经可以承接旧路径逐步迁移

### 4. 统一结果桥

当前已落地：

- `src/agent_core/capability-result/**`

这里已经做成了：

- `CapabilityResultEnvelope -> KernelResult`
- `CapabilityResultEnvelope -> capability.result_received event`

而且已经保住现有兼容点：

- `resultSource`
- `final`
- `partial/progress` 的轻量 metadata 扩展口

这意味着：

- pool 返回结果后，已经能重新喂回 kernel loop

### 5. kernel-facing 网关

当前已落地：

- `src/agent_core/capability-gateway/**`

这层现在是一个很薄的 kernel-facing 面：

- `acquire`
- `prepare`
- `dispatch`
- `cancel`
- `onResult`
- `onBackpressure`

这意味着：

- `agent_core` 已经有了“理论上唯一应该直接依赖的能力入口”

### 6. 第一版能力池

当前已落地：

- `src/agent_core/capability-pool/**`

第一版 pool 已具备：

- registry / lifecycle
- queue
- backpressure
- result cache
- draining
- health
- direct / queued dispatch

注意：

这还是第一版骨架，不是最终工业版能力池。

但它已经足够说明：

- 我们的接口不是悬空的
- 它已经有真实执行面

### 7. 第一批 adapter

当前已落地：

- `src/agent_core/integrations/model-inference-adapter.ts`
- `src/agent_core/integrations/rax-websearch-adapter.ts`
- `src/agent_core/integrations/rax-mcp-adapter.ts`
- `src/agent_core/integrations/rax-skill-adapter.ts`

当前收口情况是：

- `model inference`
  - 已有统一 adapter
- `search.ground`
  - 已有新的 adapter
- `mcp`
  - 已有最小 skeleton
  - 当前先收短调用面和 `mcp.native.execute`
- `skill`
  - 已有最小 skeleton
  - 当前先收 `skill.use / skill.mount / skill.prepare`

这意味着：

- 新接口已经不是“只有 pool 没有能力”
- 它已经能承接第一批真实能力

## 现在还没做完的部分

### 1. 旧主路径还没完全切掉

当前旧的这些东西仍然保留：

- `CapabilityPortBroker`
- `registerCapabilityPort(...)`
- `dispatchCapabilityIntent(...)`
- 旧的 `agent_core -> rax-port` 路径

这不是坏事。

这是我们故意保留的兼容阶段：

- 新路径先接起来
- 旧路径先别硬砍
- 等新路径足够稳，再做真正切换

### 2. `AgentCoreRuntime` 只是“开始接入”，不是“完全切换”

当前已经接入的新面：

- `capabilityPool`
- `capabilityGateway`
- `registerCapabilityAdapter(...)`
- `dispatchCapabilityPlan(...)`
- `dispatchCapabilityIntentViaGateway(...)`

但还没有做到：

- 所有 runtime 能力调用都统一走新 pool
- 所有旧 port 路径都下线

### 3. `model inference` 还没完全回收

虽然现在已经有：

- `model-inference-adapter`

但当前主 runtime 里，最小直问直答闭环依然主要靠旧的专门路径维持。

这意味着：

- `model inference` 已经可以被纳入统一能力面
- 但还没有完成“主闭环完全改走新接口”

### 4. 还没有进入更高一层的池治理

例如：

- 审批 agent
- 规则 + 算法 + LLM 的分配裁决
- 多池协作
- 上层包装机对池子的编排

这些都还不在这轮“接口完成度”的范围里。

## 所以到底能不能说“接口已经完全做完了”

当前不建议这样说。

更准确的说法应该是：

### 可以说已经完成的部分

- 第一版接口设计
- 第一版接口类型
- 第一版 pool 骨架
- 第一批 adapter
- runtime 对新接口的初步接入
- 完整的类型检查与测试验证

### 还不能说完全完成的部分

- 旧路径完全下线
- runtime 完全切到新主装配
- `model inference` 主闭环完全回收到新接口
- 所有后续能力都统一接池
- 更高一层智能审批型 pool governor

所以当前最准确的结论是：

- `Capability Interface v1` 已经做成
- `Capability Interface migration` 还没有完全做完

## 当前验证基线

当前已回读通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
  - `65 pass / 0 fail`
- `npm test`
  - 仓库级 `156 pass / 0 fail`

这意味着：

- 新接口层不是只在局部测试里通过
- 它已经在当前仓库基线上通过了完整验证

## 这一阶段的最终判断

当前这一部分最合适的对外说法是：

- Praxis 的统一能力接口第一版已经落地并通过验证。
- 新的 `Capability Interface + Capability Pool + Adapter` 架构已经成立。
- `AgentCoreRuntime` 已开始接入新主路径。
- 但系统仍处在新旧并存迁移期，还不应宣称“旧路径已完全退役”。

一句压缩版：

- 接口已经做出来了
- 而且不是纸面，是代码和测试都成立了
- 但它还处在“第一版已成立，完全迁移未结束”的状态
