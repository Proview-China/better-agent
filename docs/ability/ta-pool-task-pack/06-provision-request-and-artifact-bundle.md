# WP06: Provision Request And Artifact Bundle

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把 provisioning 工单和交付包定义清楚。

## 你的任务

1. 实现 `ProvisionRequest` 契约。
2. 实现 `ProvisionArtifactBundle` 契约。
3. 明确四类 artifact：
   - `tool artifact`
   - `binding artifact`
   - `verification artifact`
   - `usage artifact`
4. 提供校验和状态辅助函数。

## 建议修改文件

- `src/agent_core/ta-pool-provision/**`
- 或 `src/agent_core/ta-pool-types/**`

## 边界约束

- 不做真实安装逻辑。
- 不接具体 MCP / shell / package manager。

## 必须包含的测试

- artifact bundle 完整性测试
- provisioning 状态流测试
