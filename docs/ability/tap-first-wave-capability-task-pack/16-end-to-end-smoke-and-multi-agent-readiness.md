# 16 End To End Smoke And Multi Agent Readiness

## 任务目标

为第一波 capability 接入补齐端到端验证，证明后面的 `CMP / MP` 多智能体已经有一套能真实使用的最小能力地基。

## 必须完成

- 补 reviewer 最小只读基线相关测试
- 补 bootstrap `TMA` 最小施工基线相关测试
- 补至少三条 `TAP` 真调度测试：
  - `search.ground`
  - `skill.*`
  - `mcp.*`
- 至少补一条 live smoke 或准 live smoke：
  - 验证第一波 capability 真的不是纸面接入
- 补多智能体 readiness 说明：
  - 哪些能力现在能直接给后面的 `CMP / MP` worker 用
  - 哪些仍要走 `TAP` 审批

## 允许修改范围

- `src/agent_core/**/*.test.ts`
- `src/rax/**/*.test.ts`
- 必要时少量新增 smoke script
- 必要时更新 `docs/ability/` 阶段状态文档

## 不要做

- 不要在这里再改 capability contract
- 不要再改 mode matrix

## 验收标准

- `typecheck` 通过
- `agent_core` 定向测试通过
- 第一波 capability 的新增测试全部通过
- 至少一条 smoke 能证明能力不是假接入

## 交付说明

- 最终说明里列出：
  - 当前已可直接复用的能力
  - 当前仍需审批的能力
  - 当前仍未接入的高外部性能力
