# WP03: Control-Plane Gateway

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

定义主 agent 如何和 `T/A Pool` 控制面交互的薄入口。

## 你的任务

1. 设计 `kernel-facing` 的控制面 gateway。
2. 入口至少覆盖：
   - baseline check
   - submit access request
   - receive decision
   - translate grant to execution request
   - signal provisioning / human escalation / deny
3. 保持入口极薄，不暴露 reviewer / provisioner 内部细节。

## 建议修改文件

- `src/agent_core/ta-pool-runtime/**`
- 或 `src/agent_core/ta-pool-review/**`

## 边界约束

- 不直接执行 capability。
- 不把现有 `CapabilityPool` 逻辑复制过来。

## 必须包含的测试

- gateway 对 baseline fast path 的测试
- gateway 对 review decision 分流测试
