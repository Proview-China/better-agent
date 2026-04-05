# 11 Skill Family TAP Package And Runtime

## 任务目标

把 `skill.use / skill.prepare / skill.mount` 正式整理成 `TAP` 第一波 capability family，并补 TAP 真实调度验证。

## 必须完成

- 为 `skill.use`
- 为 `skill.prepare`
- 为 `skill.mount`
  各自定义 package 或 family 级 package 映射策略
- 确保 `RaxSkillCapabilityAdapter` 适配当前 `skill` 输入模型
- 补 `agent_core/runtime.test.ts` 级别测试：
  - 至少一条 `dispatchCapabilityIntentViaTaPool(...)` 能真实穿过 `skill` capability

## 允许修改范围

- `src/agent_core/integrations/rax-skill-adapter.ts`
- `src/agent_core/integrations/rax-skill-adapter.test.ts`
- `src/agent_core/capability-package/**`
- `src/agent_core/runtime.test.ts`

## 不要做

- 不要把 `skill.doc.generate` 混进 runtime execute family
- 不要在这里补 live registry 系统

## 验收标准

- `skill.*` 至少有一条真 capability 能通过 `TAP`
- package / adapter / runtime 三层都有测试

## 交付说明

- 明确 `skill.use/prepare/mount` 是否共用 family policy
