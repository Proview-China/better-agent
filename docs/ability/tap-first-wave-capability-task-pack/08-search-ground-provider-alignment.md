# 08 Search Ground Provider Alignment

## 任务目标

把 `search.ground` 这族能力先在 `rax` provider 路由层收口好，再交给 `TAP` 正式接入。

## 必须完成

- 吸收当前已验证有价值的 websearch 收口点：
  - OpenAI `maxOutputTokens -> max_output_tokens`
  - Anthropic governed-task prompt 构建
  - compatibility blocked 的可解释性测试
  - Anthropic agent 路径 Windows fail-fast guard
- 保持 provider truthfulness：
  - 不强说三家完全等价
  - contract 按 provider 缩窄
- 补 `rax` 层相关测试：
  - router
  - runtime
  - result
  - live smoke 的 provider 语义

## 允许修改范围

- `src/integrations/**/search/**`
- `src/integrations/openai/api/tools/websearch/adapter.ts`
- `src/rax/websearch-*.ts`
- `src/rax/router.test.ts`
- `src/rax/runtime.test.ts`

## 不要做

- 不要整包替换 `src/rax/*`
- 不要直接改成“Anthropic 默认一律走 api”而不补完整实现和验证

## 验收标准

- `search.ground` 在 `rax` 层的 contract truthfulness 更强
- OpenAI/Anthropic/DeepMind 的差异被明确保留
- 回归测试能证明 compatibility block 不是上游宕机语义

## 交付说明

- 明确哪些逻辑来自 `origin/issue-2-websearch-alignment`
