# 2026-03-14 Skill Cross-SDK Research

## 本次结论

- `skill` 可以继续作为 Praxis 的厚能力候选推进，但当前仍处于研究阶段，不宜直接冻结为最终规范。
- 三家官方体系都能给出可参考信号，但 `skill` 的共同抽象不应直接照搬任何一家 SDK 的具体形状。
- 当前更稳的方向是把 `skill` 视为 runtime plane 上的“能力包”，而不是：
  - 单次工具调用
  - 单个 prompt 文件
  - 某家 SDK 的原生对象实例

## 三家研究收口

### OpenAI

- 官方已有 `Skills` 概念。
- 更接近：
  - versioned bundle
  - runtime attachment
  - lazy materialization
  - explicit safety
- 但当前较强绑定 shell/runtime 语义，不宜直接视为通用真身。

### Anthropic

- 官方对 `skill` 的定义最完整。
- 更接近：
  - metadata + instructions
  - resources/examples/templates/scripts
  - progressive disclosure
  - invocation policy
  - subagent/hooks 组合
- Anthropic 当前的 filesystem-first 落地方式不应直接当作跨 provider 标准。

### Google / Gemini ADK

- Google ADK 现已有官方 `Skills for ADK agents`，但仍处于 experimental 阶段。
- 当前 ADK skill 已支持：
  - `SKILL.md`
  - metadata / instructions / resources 三层结构
  - 从文件目录加载
  - 在代码里定义 `Skill`
- Gemini 当前“skill 兼容性更差”的核心原因，更接近成熟度和能力完备度不足，而不是概念完全缺位。

## 当前更稳的抽象候选

- `SkillDescriptor`
- `SkillBundle`
- `SkillExecutionPolicy`
- `SkillBinding`
- `SkillStateBridge`
- `SkillLedger`

## 当前明确不拍板的点

- 不冻结最终 TypeScript interface。
- 不冻结 `new Skill().create(...)` 这类对象式 API。
- 不把 Anthropic / OpenAI / Google 任一家的当前实现直接当作通用规范。

## 下一步建议

1. 先画 Praxis 内部 `skill lifecycle`：
   - discover
   - match
   - load
   - bind
   - activate
   - record
2. 先写三家 provider mapping 表，再决定接口层长什么样。
