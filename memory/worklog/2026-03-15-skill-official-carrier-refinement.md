# 2026-03-15 Skill Official Carrier Refinement

## 本次结论

- `rax.skill` 的最小代码骨架继续向三家官方 carrier 形状收紧。
- 当前方向保持不变：
  - `skill` 做官方承载薄层
  - 更复杂的能力组织继续放回包装机/Context Manager

## 本次实现

- 继续完善：
  - `src/rax/skill-runtime.ts`
  - `src/rax/skill-types.ts`
- 当前可用方法：
  - `rax.skill.loadLocal()`
  - `rax.skill.define()`
  - `rax.skill.containerCreate()`
  - `rax.skill.discover()`
  - `rax.skill.bind()`
  - `rax.skill.activate()`

## 当前更贴官方的 carrier 计划

- OpenAI：
  - `shell`
  - `environment.skills`
- Anthropic：
  - API 路：`container.skills` + `code_execution`
  - SDK 路：filesystem `Skill`
- Google ADK：
  - `SkillToolset`

## 当前验证

- `npm run typecheck` 通过
- `npm test` 通过
- 当前结果：
  - `50 pass / 0 fail`
