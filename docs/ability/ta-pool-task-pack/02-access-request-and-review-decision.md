# WP02: Access Request And Review Decision

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把申请工单和审核决定做成稳定契约。

## 你的任务

1. 实现 `AccessRequest` 构造与校验。
2. 实现 `ReviewDecision` 及其状态辅助函数。
3. 明确 `deferred` 语义：
   - 不是拒绝
   - 是挂起等待条件满足
4. 提供 decision -> grant / escalation / provisioning 的映射辅助函数。

## 建议修改文件

- `src/agent_core/ta-pool-review/**`
- 仅限契约与纯函数部分

## 边界约束

- 不做真实 reviewer agent。
- 不做 queue / runtime。

## 必须包含的测试

- 六种 decision 全覆盖测试
- `deferred` 分支语义测试
- 部分批准范围裁剪测试
