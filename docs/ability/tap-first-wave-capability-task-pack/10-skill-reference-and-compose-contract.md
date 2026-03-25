# 10 Skill Reference And Compose Contract

## 任务目标

先把 `skill` 族在 `rax`/adapter 层的输入模型和 compose truthfulness 收口好，再谈 `TAP` 接入。

## 必须完成

- 吸收 skill 族当前最有价值的收口点：
  - `skill.use` 支持 `source | container | reference`
  - `virtual skill reference`
  - `composeStrategy`
  - `composeNotes`
- 明确哪些 skill carrier 是：
  - `payload-merge`
  - `runtime-only`
- 补 skill runtime / facade / adapter 的合同测试

## 允许修改范围

- `src/rax/skill-types.ts`
- `src/rax/skill-runtime.ts`
- `src/rax/facade.ts`
- `src/rax/index.ts`
- `src/agent_core/integrations/rax-skill-adapter.ts`
- 对应 tests

## 不要做

- 不要整文件替换 `src/rax/facade.ts`
- 不要把 `virtual://skill/...` 当成 durable 事实模型

## 验收标准

- skill 输入模型不再只吃 `source`
- runtime-only 与 payload-merge 的边界被写死并测试覆盖

## 交付说明

- 明确哪些逻辑来自 `origin/issue-4-skill-adapter-fixes`
