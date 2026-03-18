# WP10: Rax Skill Adapter Skeleton

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

为 `skill` 能力建立 `CapabilityAdapter` 骨架，把当前最复杂的能力包 runtime 收进统一接口框架。

## 项目背景

- `skill` 当前是最完整的厚能力线之一
- 但它同时包含：
  - local package lifecycle
  - provider carrier binding
  - managed registry lifecycle
- 第一版统一能力池不应该一次吃掉全部 skill 语义

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/rax/facade.ts`
- `src/rax/skill-types.ts`
- `src/rax/skill-runtime.ts`

## 你的任务

1. 建立 `skill` adapter 的最小骨架。
2. 先明确第一版统一能力面更适合接的 skill 动作。
3. 建议优先覆盖：
   - `skill.use`
   - `skill.mount`
   - 必要时 `skill.prepare`
4. 明确哪些 managed registry lifecycle 仍保持 provider-facing prepare-only。

## 建议新增文件

- `src/agent_core/integrations/rax-skill-adapter.ts`
- `src/agent_core/integrations/rax-skill-adapter.test.ts`

## 边界约束

- 不要试图一次打通全部 skill managed lifecycle
- 不要把 OpenAI/Anthropic/Google 的 carrier payload 暴露到 kernel-facing 层
- 不要改 `skill` 既有官方对齐语义

## 必须考虑的性能点

- progressive loading
- skill carrier prepare cache
- 大 bundle / resource 不进入 kernel 热路径

## 验证要求

- `npm run typecheck`
- 以 skeleton contract test 为主
- 至少验证：
  - `supports`
  - `prepare`
  - 最小 `execute/use` 映射

## 最终汇报格式

1. 你实现了哪些文件
2. 第一版 `skill` adapter 收哪些动作
3. 哪些 skill 生命周期仍保持 provider-facing
4. progressive loading 在接口里怎么承接
5. 后续完整接 skill 时最大的风险点是什么
