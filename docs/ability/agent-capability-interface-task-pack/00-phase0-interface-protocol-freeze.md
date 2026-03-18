# Phase 0: Interface Protocol Freeze

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

冻结 `agent_core -> capability interface -> capability pool` 的共享协议与类型，为后续所有并行编码任务提供稳定接口。

你是协议冻结负责人，不负责实现完整业务逻辑。

## 项目背景

- 当前仓库已有可运行的 `agent_core raw runtime kernel`
- 当前仓库已有 `src/rax/**` 能力 runtime，例如：
  - `websearch`
  - `mcp`
  - `skill`
- 当前新主线不是扩更多能力，而是先把统一能力接口与能力池做出来
- 当前接口总纲已经定在：
  - `docs/ability/17-agent-capability-interface-and-pool-outline.md`

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `docs/master.md`
- `memory/current-context.md`
- `src/agent_core/types/**`
- `src/rax/types.ts`
- `src/rax/contracts.ts`

## 你的任务

1. 在 `src/agent_core/capability-types/` 下建立共享协议与类型定义。
2. 冻结所有后续工作包都会依赖的最小接口。
3. 不实现完整 pool/runtime 逻辑。
4. 保持类型“小而硬”，为热插拔和高性能留口，但不提前引入复杂框架。

## 建议新增文件

- `src/agent_core/capability-types/capability-manifest.ts`
- `src/agent_core/capability-types/capability-binding.ts`
- `src/agent_core/capability-types/capability-invocation.ts`
- `src/agent_core/capability-types/capability-execution.ts`
- `src/agent_core/capability-types/capability-result.ts`
- `src/agent_core/capability-types/capability-gateway.ts`
- `src/agent_core/capability-types/index.ts`

## 你必须冻结的最小概念

- `CapabilityManifest`
- `CapabilityBinding`
- `CapabilityBindingState`
- `CapabilityLease`
- `CapabilityInvocationPlan`
- `PreparedCapabilityCall`
- `CapabilityExecutionHandle`
- `CapabilityResultEnvelope`
- `CapabilityBackpressureSignal`
- `KernelCapabilityGateway`
- `CapabilityPool`
- `CapabilityAdapter`

## 你必须明确的边界

- 哪些字段属于 `kernel-facing`
- 哪些字段属于 `pool-facing`
- 哪些字段属于 `provider-facing`
- 哪些字段绝不能泄漏进 `agent_core`

## 边界约束

- 不要修改 `src/rax/**`
- 不要写完整 pool 实现
- 不要写具体 provider adapter
- 不要写治理层审批系统
- 不要引入复杂 schema migration / distributed coordination

## 验证要求

- `npm run typecheck`
- 若需要，可为类型模块补最小编译型测试
- 最终说明哪些类型是强冻结接口，哪些字段允许未来扩展

## 最终汇报格式

1. 你新增/修改了哪些文件
2. 你冻结了哪些核心类型
3. 哪些字段是 kernel-facing 必需字段
4. 哪些字段被明确下沉到 pool/provider 层
5. 后续工作包最关键的共享依赖是什么
