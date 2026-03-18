# WP00: Phase 0 Protocol Freeze

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

冻结 `T/A Pool` 第一版共享协议，给后续所有工作包提供稳定对象与枚举。

## 你必须先阅读

- `docs/ability/20-ta-pool-control-plane-outline.md`
- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `memory/current-context.md`

## 你的任务

1. 冻结以下对象的第一版类型：
   - `AgentCapabilityProfile`
   - `AccessRequest`
   - `ReviewDecision`
   - `CapabilityGrant`
   - `ProvisionRequest`
   - `ProvisionArtifactBundle`
2. 冻结以下枚举：
   - `B0-B3`
   - `strict / balanced / yolo`
   - `approved / partially_approved / denied / deferred / escalated_to_human / redirected_to_provisioning`
3. 明确共享字段命名与状态流转。
4. 补充类型测试与快照测试。

## 建议修改文件

- `src/agent_core/ta-pool-types/**`

## 边界约束

- 只做协议，不做 runtime。
- 不要提前引入真实 reviewer / provisioner 执行逻辑。
- 不要改现有 `capability-types/**` 已稳定对象，除非确有桥接需要。

## 验证要求

- `npm run typecheck`
- 新增 `ta-pool-types` 测试通过

## 最终汇报格式

1. 你冻结了哪些对象
2. 哪些字段最关键
3. 哪些地方故意先留可扩展口
