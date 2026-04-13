# Codex Official Prompt Mapping For Praxis

状态：活文档 / 第一稿。

更新时间：2026-04-07

## 这份文档的定位

这份文档不直接产出最终 system prompt。

它的用途是：

- 读 OpenAI 开源 Codex 最新 prompt 工程
- 抽取真正值得复用的骨架
- 明确哪些是 Codex CLI 私货，不能直接搬进 Praxis
- 作为后续修改 `60 / 61 / 62` 的映射基线

## 本轮审查对象

本轮主要对照了这些文件：

- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/prompt.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/gpt_5_1_prompt.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/gpt_5_2_prompt.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/gpt_5_codex_prompt.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/gpt-5.1-codex-max_prompt.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/gpt-5.2-codex_prompt.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/prompt_with_apply_patch_instructions.md`
- `/home/proview/Desktop/codex-0.118/codex-rust-v0.118.0/codex-rs/core/review_prompt.md`

## 总结先说

Codex 官方 prompt 最值得借的不是某一大段具体措辞，而是一套稳定的行为骨架：

1. 身份定义清晰
2. 指令优先级清晰
3. 默认持续执行，不停在分析层
4. 根因优先、最小改动、先小验证后大验证
5. 对用户持续更新
6. 最终回复保持简洁、可交付、可扫描

一句白话：

- 它强的地方是“工作方法”
- 不是“某个神秘句子”

## 最值得借的骨架

### 一、Autonomy And Persistence

Codex 新版 prompt 很强调：

- 默认把任务做完
- 不要停在分析和建议层
- 如果用户不是明显在 brainstorm，就直接动手

这和 Praxis 很契合，但要做一个关键改写：

- Codex 是“单体 agent 自己往前推”
- Praxis 应写成“`core` 亲自做事，同时主动向 `CMP / TAP / MP` 取支撑”

### 二、Root-Cause Fixing

Codex prompt 明确偏好：

- 修根因
- 少做表面补丁
- 不顺手修无关问题

这部分可以几乎完整吸收进 Praxis，尤其适合 `core` prompt。

### 三、Validation Ladder

Codex prompt 很强调：

- 测试从小到大
- 先针对改动点，再往更大范围扩

这部分非常适合 Praxis，但验证对象要换成：

- `runtime` tests
- `TAP / CMP` focused tests
- live smoke / breakpoint smoke

### 四、Progress Updates

Codex GPT-5.1 / 5.2 prompt 里把“用户更新协议”写得比旧版更强。

这一点很值得借。

但 Praxis 不应该写成 Codex CLI UI 协议，而应抽象成：

- 长链路工作时，持续给用户短更新
- 说明当前锚点、发现和下一步

### 五、Two-Layer Prompt Design

Codex 官方实际上是：

- 一份稳定长骨架
- 多份模型专属或模式专属增量层

这对 Praxis 提示词工程非常重要。

我们也应采用：

- `长期宪法层`
- `角色层`
- `运行形态增量层`

## 明确不能照搬的部分

### 一、CLI/Harness 私货

这些不能直接进 Praxis prompt：

- `Codex CLI`
- `terminal-based coding assistant`
- `same computer`
- `CLI renderer`
- `apply_patch` grammar
- `update_plan` 的精确协议
- `spawn_agent / wait_agent / close_agent`
- `approval mode`
- `sandbox mode`

原因：

- 它们是 Codex 产品壳的运行时现实
- 不是 Praxis agent 本体的长期宪法

### 二、单体代理自己包办治理

Codex prompt 默认很多治理、审批、tool approval 都由主 agent 直接面对用户处理。

Praxis 不能这么搬。

因为在 Praxis 里：

- 能力审批、风险处理、交付、回放，应该由 `TAP` 托底
- 上下文整理、保鲜、传递，应该由 `CMP` 托底

### 三、最终回复格式细则

Codex 的大量最终回复规则是为 CLI UI 服务的。

Praxis 可以借“简洁、扫描友好、少废话”这个方向，
但不能把它们当成 prompt 核心主体。

## 对 Praxis 三块草案的具体影响

### 一、对 `core` 的影响

应直接吸收：

- autonomy and persistence
- root-cause fixing
- validation ladder
- progress updates
- honesty / no guessing

但必须改写成：

- `core` 是真正干活的主 agent
- `core` 不绕过 `CMP / TAP / MP`
- `core` 主动请求支撑，而不是单兵包办全部治理

### 二、对 `TAP` 的影响

应吸收：

- 结构化边界
- 明确禁止项
- 失败时收窄而不是乱编
- 持续可审计

但不能吸收：

- 主 agent 直接向用户要权限这一套

因为在 Praxis 里，这本来就是 TAP 自己的职责。

### 三、对 `CMP` 的影响

应吸收：

- 明确身份
- 明确输入输出 contract
- 明确禁止项
- 强调长期运行中的上下文保鲜和边界纪律

但不能把 Codex 单体 prompt 里的“自己维持全部上下文”原样搬来，
因为 Praxis 的目标正是让 `CMP` 专门承担这部分脏活累活。

## 对后续 prompt 工程的建议

1. 先把 `core` 改成“官方骨架 + Praxis 控制面改写版”
2. 再把 TAP 三角色写成“治理服务 prompt”，不是执行 prompt
3. 最后把 CMP 五角色写成“上下文服务 prompt”，不是第二主脑 prompt

## 当前最值得保住的原则

如果只保住五条，我建议保这些：

1. 默认持续执行，不停在分析层
2. 修根因，不修表面
3. 不猜，不编，不假通过
4. 先小验证，再大验证
5. `core` 永远不绕过 `CMP / TAP / MP`
