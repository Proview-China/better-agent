# CMP Five-Agent Live LLM Outline

状态：下一阶段总纲 / 真实 LLM 化。

更新时间：2026-03-30

## 这份文档回答什么

这份文档专门回答：

- 为什么现在可以开始把 `CMP` 五角色往真实 `LLM` 使用推进
- 当前已经具备了哪些前提，不需要再回跳公共底座
- 五角色“真实使用 LLM”第一阶段到底做什么，不做什么
- 后续任务应该怎样拆，才能让多智能体并发落地而不把系统搞乱

一句白话：

- 现在不是继续讨论五个角色该不该存在
- 而是要把五个角色从“结构化规则骨架”推进到“受控、可验证、可回滚的 LLM 工作系统”

## 当前阶段一句话

`CMP` 的非五-agent 底座、`rax.cmp`、`part6 acceptance gate`、`gmn` 上游 live 模型接线都已经基本成立。

当前最合理的下一阶段是：

1. 保持现有硬控制面不动
2. 把五角色内部逐步接成真实 `LLM` loop
3. 先做“模型参与但仍受硬规则约束”的第一版
4. 再做 live 验收，而不是直接放开成完全自治

## 当前已经成立的前提

### 1. `gmn` 现在是可用上游

当前 live truth 已确认：

- `GET /v1/models` 可用
- `POST /v1/chat/completions` 可用
- `POST /v1/responses` 可用
- `OpenAI SDK responses.create(...)` 可用

并且我们已经为当前 `gmn` 路由补了一个关键兼容点：

- `responses + metadata` 在该路由上可能触发 `502`
- `model-inference` 已支持去掉顶层 `metadata` 后重试

白话：

- 模型网关不是阻塞点了
- 现在真正的工作重点回到五角色本身

### 2. 当前 live 不是空白

当前已经真实成立：

- `executeModelInference()` live 可跑
- `runUntilTerminal()` live 可跑
- `CMP` 主动主链：
  - `ingest -> commit -> resolve -> materialize -> dispatch`
  已可跑

所以现在不是“先把模型接上”阶段，
而是“把模型真正嵌进五角色工作逻辑”阶段。

### 3. 当前五角色还没有真正 live LLM 化

当前最准确的事实不是：

- 五个角色都已经在真实靠模型思考和执行

而是：

- 五个角色当前主要还是：
  - 结构化状态机
  - 角色配置
  - 提示词模板
  - readback / readiness / gate

也就是说，现在更像：

- `LLM-ready skeleton`

而不是：

- `LLM-driven five-agent system`

## 当前唯一目标

在不破坏现有：

- `core_agent -> rax.cmp -> cmp-runtime -> five-agent runtime`

这条主链，
以及不破坏：

- 现有 `TAP` 能力治理
- 现有 `acceptance gate`
- 现有 `recovery / observability`

的前提下，
把五角色推进到下面这个第一版完成口径：

1. 每个角色都至少有一个真实 `LLM` 决策或整理步骤
2. `LLM` 输出必须进入稳定 schema，而不是自由文本直写真相
3. 所有真相写口仍然由硬规则与角色权限控制
4. 任一角色 live 失败时，系统仍能回退到可解释的受控状态
5. `readback / smoke / acceptance` 能看见：
   - 哪些角色已经 live
   - 哪些角色还只是规则骨架
   - live 调用失败在哪一步

## 第一版真实 LLM 化的硬原则

### 1. 不是“让 LLM 接管一切”

第一版不做：

- 让模型直接写 raw truth
- 让模型自己决定跨层广播
- 让模型绕过 `TAP`
- 让模型决定 override / admin 行为

第一版只做：

- 模型参与切块
- 模型参与重整
- 模型参与裁剪
- 模型参与候选说明与结构化输出

### 2. 模型输出必须先变成结构化候选

每个角色的 live `LLM` 输出必须先落成：

- `structured candidate`
- `review candidate`
- `materialization candidate`
- `route candidate`

再由硬规则决定：

- 是否接受
- 是否落盘
- 是否继续推进

### 3. 真相口仍然是规则写

当前不能改变的点：

- git 写口仍由角色权限控制
- DB 写口仍由 `DBAgent` 主控
- MQ 写口仍按 lineage / parent-child / peer gate 控制
- package / snapshot / section / request 的最终写入仍不是模型自由写

### 4. 每个角色都要有 live 降级模式

第一版每个角色都要支持：

- `rules_only`
- `llm_assisted`
- `llm_required`

默认起步建议：

- 先用 `llm_assisted`

白话：

- 先让模型帮忙
- 不先让模型成为唯一依赖

## 五角色第一版 live LLM 目标

### 1. `ICMA`

第一版真实 `LLM` 目标：

- 对输入材料做：
  - 任务意图切块
  - source anchor 整理
  - pre-section candidate body 提取
  - child guide / operator guide 生成

模型做什么：

- 从原始输入里挑高信噪比片段
- 组织成可供下游使用的结构化候选

规则仍做什么：

- 控制 fragment 类型
- 控制 root system 不被重写
- 控制 child seed 只能进 child `ICMA`

### 2. `Iterator`

第一版真实 `LLM` 目标：

- 生成 candidate commit summary
- 生成 review ref 注释
- 判断当前变动是否值得推进到下一审查点

模型做什么：

- 对事件和 section 变化做“推进解释”

规则仍做什么：

- 最小单元仍是 `commit`
- git 主写权限不变
- 真正 git ref 更新仍由规则执行

### 3. `Checker`

第一版真实 `LLM` 目标：

- section-level 拆分 / 合并建议
- trimming / noise removal
- checked-ready explanation
- suggest-promote explanation

模型做什么：

- 做高信噪比重整
- 生成结构化 review decision

规则仍做什么：

- `checked` 和 `suggest-promote` 分离
- 不允许模型直接 promote
- 父层协作路径不变

### 4. `DBAgent`

第一版真实 `LLM` 目标：

- 根据 checked snapshot 和 request state 生成 package candidate 说明
- 生成 task snapshot summary candidate
- 生成 passive reply / reintervention 的结构化 packaging hint

模型做什么：

- 帮助组织“应该装进包里的高信噪比内容”

规则仍做什么：

- 最终 package family / timeline / snapshot attach 仍由规则写
- DB 结构化写权限仍只给 `DBAgent`

### 5. `Dispatcher`

第一版真实 `LLM` 目标：

- 生成 route rationale
- 生成 child seed / peer exchange / passive return 的 body candidate
- 生成 governance hint

模型做什么：

- 帮助说明“为什么这个包应该这样送”

规则仍做什么：

- child 只进 child `ICMA`
- peer exchange 仍需父侧批准
- 不允许模型绕过 route policy

## 实施顺序

### Wave 1 / 先打通通用 live LLM I/O

先做：

- provider bridge
- role-level LLM invocation contract
- role-level fallback mode

原因：

- 不先把调用面做稳，后面每个角色都会重复返工

### Wave 2 / 先让 `ICMA + Checker` live

这两个角色最适合先 live：

- `ICMA` 负责高信噪比入口整理
- `Checker` 负责高信噪比重整与精裁

白话：

- 一头一尾先让模型参与
- 会最快提升整条链质量

### Wave 3 / 再接 `Iterator + DBAgent`

因为这两个角色都贴着真相写口：

- 一个贴着 git
- 一个贴着 DB / package

所以必须在 `ICMA + Checker` 稳定后再接。

### Wave 4 / 最后接 `Dispatcher`

因为它是最终 delivery 面，
一旦过早 live，最容易把路线和治理边界弄乱。

## 当前阶段的完成定义

只有同时满足下面这些条件，
才算“五角色真实使用 LLM 第一阶段”完成：

1. 五角色都有可调用的 live `LLM` path
2. 每个角色都有：
   - `rules_only`
   - `llm_assisted`
   - `llm_required`
3. 所有 live 输出都进入稳定 schema
4. 所有真相写口仍然由规则执行
5. `readback / smoke / acceptance` 已能明确看到每角色 live readiness
6. `gmn` 上游已能支撑这一阶段的最小 live 验证

## 这一阶段明确不做的事

- 不做多模型混跑策略
- 不做五角色全自动自治
- 不做让 `LLM` 直接写 DB/git/MQ
- 不做跨项目泛化优化
- 不做 `MP` 联动
- 不因为 live 需要而回跳重写 `CMP` 公共底座
