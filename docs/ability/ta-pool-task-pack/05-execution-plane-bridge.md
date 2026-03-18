# WP05: Execution Plane Bridge

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把控制面的 grant / decision 正确 lower 到现有 `CapabilityPool` execution plane。

## 你的任务

1. 设计 `CapabilityGrant -> CapabilityInvocationPlan / Lease` 的桥接层。
2. 让控制面可以无痛使用现有 `CapabilityPool`。
3. 保证 execution plane 不需要知道 reviewer / provisioner。

## 建议修改文件

- `src/agent_core/ta-pool-runtime/**`
- `src/agent_core/runtime.ts` 如有必要先只做桥接口

## 边界约束

- 不重写现有 `CapabilityPool`。
- 不改 provider adapter 细节。

## 必须包含的测试

- grant 到 execution dispatch 的桥接测试
- denied / deferred 不进入 execution plane 的测试
