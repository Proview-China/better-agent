# Part 6 Recovery And Acceptance Gate

## 目标

把 recovery、human override、最终 acceptance gate 收成可交付状态。

## 子任务

1. recovery 主链
- 覆盖：
  - `request`
  - `section`
  - `package`
  - `snapshot`

2. override 边界
- 只开放：
  - `pause`
  - `resume`
  - `retry`
  - `rebuild`

3. acceptance gate
- 至少包含：
  - 对象模型完整性
  - 五角色 loop 完整性
  - bundle schema 完整性
  - `TAP` 深接线完成度
  - live infra readiness
  - recovery readiness

4. `rax.cmp` 最终看板
- `readback`
- `smoke`
- line status
- package status
- request status
- recovery status
