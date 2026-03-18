# WP1: KernelCapabilityGateway

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

实现 `KernelCapabilityGateway`，作为 `agent_core` 调能力的唯一 kernel-facing 接口。

## 项目背景

- `agent_core` 当前已具备 run loop、event journal、checkpoint、port broker 雏形
- 新阶段要求 kernel 不再直接碰厚能力对象
- kernel 热路径只应看到：
  - `capability key`
  - `invocation plan`
  - `execution handle`
  - `result envelope`
  - `backpressure signal`

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/runtime.ts`
- `src/agent_core/types/**`
- `src/agent_core/port/**`
- `src/agent_core/capability-types/**`

## 你的任务

1. 在 `src/agent_core/capability-gateway/` 下实现 kernel-facing gateway。
2. 提供：
   - `acquire`
   - `prepare`
   - `dispatch`
   - `cancel`
   - `onResult`
   - `onBackpressure`
3. 保持它只做薄桥接，不吞并 pool 内部逻辑。
4. 为现有 runtime 后续替换旧 `CapabilityPortBroker` 调用面做准备。

## 建议新增文件

- `src/agent_core/capability-gateway/kernel-capability-gateway.ts`
- `src/agent_core/capability-gateway/gateway-types.ts`
- `src/agent_core/capability-gateway/kernel-capability-gateway.test.ts`
- `src/agent_core/capability-gateway/index.ts`

## 边界约束

- 不要实现完整 registry
- 不要实现具体 provider adapter
- 不要在 gateway 中硬编码 `websearch/mcp/skill`
- 不要直接引入 provider/model/layer 细节进 kernel-facing API

## 必须考虑的性能点

- gateway 自身不应持有大对象状态
- 监听器回调要轻量
- acquisition/prepare/dispatch 路径要能保持短调用链
- 为 fast-path 留口

## 验证要求

- `npm run typecheck`
- 覆盖：
  - gateway 正确转发到 pool
  - result listener 正常回调
  - backpressure listener 正常回调
  - cancel 可向下传递

## 最终汇报格式

1. 你实现了哪些文件
2. gateway 的最小调用流是什么
3. kernel-facing 层现在明确屏蔽了哪些细节
4. 它与旧 `CapabilityPortBroker` 的关系是什么
5. 后续联调最容易出问题的接口点是什么
