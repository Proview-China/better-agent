# WP12: Runtime Assembly And Integration

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把 `T/A Pool` 控制面装回 `agent_core`，并桥接到现有 `CapabilityPool` execution plane。

## 你的任务

1. 把 control plane runtime 装配进 `AgentCoreRuntime`。
2. 保证 baseline fast path 成立。
3. 保证 review / provisioning / denial / escalation 可以从 runtime 走通。
4. 保持兼容，不要粗暴删除现有 `CapabilityPool` 路径。

## 建议修改文件

- `src/agent_core/runtime.ts`
- `src/agent_core/index.ts`
- `src/agent_core/ta-pool-runtime/**`

## 边界约束

- 不顺手大改现有 capability adapter。
- 不顺手做完整治理 system。

## 必须包含的测试

- baseline capability 直通测试
- request -> review -> grant -> execution 测试
- request -> provision -> review -> execution 测试
- deny / human escalation 测试
