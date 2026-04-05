# 09 Search Ground TAP Package And Runtime

## 任务目标

把 `search.ground` 正式整理成 `TAP` 第一波 first-class capability package，并补 runtime/TAP 侧验证。

## 必须完成

- 为 `search.ground` 生成正式 capability package
- 确保 `RaxWebsearchAdapter` 的输入透传覆盖：
  - `layer`
  - `compatibilityProfileId`
  - `allowedDomains`
  - `blockedDomains`
  - `maxOutputTokens`
  - `freshness`
- 补 `agent_core` 层测试，证明 `search.ground` 能穿过当前 `TAP` 主链
- 明确 `search.ground` 在 baseline/profile 中的位置

## 允许修改范围

- `src/agent_core/integrations/rax-websearch-adapter.ts`
- `src/agent_core/integrations/rax-websearch-adapter.test.ts`
- `src/agent_core/capability-package/**`
- `src/agent_core/runtime.test.ts`

## 不要做

- 不要重写 `search.ground` 的底层 provider runtime
- 不要把它和 `search.web`、`browser search` 混成一个 capability

## 验收标准

- `search.ground` 拥有正式 package 和 adapter 测试
- 至少一条 `TAP` 真实调度测试覆盖它

## 交付说明

- 明确它是否属于默认 baseline，还是 allowed pattern
