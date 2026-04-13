# Core System v1 Engineering Spec

状态：草案 / 用于把 `core` 的提示词工程从 docs-first 推向正式装配。

更新时间：2026-04-12

## 当前唯一目标

在 `integrate/dev-master-cmp` 上，为 Praxis `core` 明确一份可落地的三层提示词工程规格：

- `core-system/v1`
- `core-development/v1`
- `core-contextual-user/v1`

这份规格不是最终文案定稿，而是工程边界说明书。

一句白话：

- 先决定哪层该装什么
- 再决定怎么把现在那两大坨手工字符串拆开

## 先说结论

Praxis `core` 当前最合理的方向仍然是：

`短 system、厚 development、强 contextual assembly`

更具体地说：

1. `core-system/v1`
   只承载长期稳定的身份、职责、哲学、禁止项、恢复性纪律。
2. `core-development/v1`
   承载当前 runtime 的制度、控制面交互规则、工具与验证纪律。
3. `core-contextual-user/v1`
   承载当前回合的真实工作现场，并且应走块化、结构化装配。

当前最大的工程问题不是“system 文案还不够漂亮”，而是：

- `buildCoreActionPlannerInstructionText(...)`
- `buildCoreUserInput(...)`

把这三层东西大量混在了一起。

## 一、Scope 与 Non-Goals

### Scope

本规格只覆盖 `core` 主 agent 的提示词装配。

包括：

- built-in system prompt
- development/runtime discipline prompt
- contextual user assembly

### Non-Goals

本规格不直接覆盖：

- `CMP` 五角色 prompt pack
- `TAP` 三角色 prompt pack
- `MP` prompt pack
- TUI 展示协议
- 全仓统一 prompt registry

## 二、Core Prompt Assembly 的正式目标

Praxis `core` 的最终装配目标应是四层模型：

### Layer 0: Model Profile Layer

承载：

- 模型型号
- reasoning effort
- verbosity
- 该模型的固定 route plan

它不是 prompt 正文层。

### Layer 1: `core-system/v1`

承载：

- `core` 的长期身份
- `core` 与 `CMP / TAP / MP` 的长期关系
- 长期工作哲学
- 长期禁止项
- 长期恢复性与可继续性纪律

一句白话：

- 它是宪法

### Layer 2: `core-development/v1`

承载：

- 当前运行制度
- 当前控制面交互规程
- 当前工具与能力治理纪律
- 当前验证纪律
- 当前 blocked / exhausted / incomplete 语义
- 当前 harness 的执行规则

一句白话：

- 它是操作手册

### Layer 3: `core-contextual-user/v1`

承载：

- 当前用户消息
- 当前 transcript 窗口
- 当前 `CMP` 高信噪比包
- 当前 `TAP` 能力窗口与能力使用索引
- 当前工具结果
- 当前 grounding evidence
- 当前回合局部事实与约束

一句白话：

- 它是今天桌面上的工作现场

## 三、`core-system/v1` 应包含什么

`core-system/v1` 只允许出现下列五类内容。

### 1. 长期身份

必须明确：

- `core` 是真正负责把任务做掉的主 agent
- `core` 不是纯 manager
- `core` 不是纯 planner
- `core` 不是纯调度器

### 2. 长期架构关系

必须明确：

- `CMP` 是上下文治理面
- `TAP` 是能力治理面
- `MP` 是记忆与拓扑治理面
- `core` 需要它们，也受它们约束

### 3. 长期工作哲学

建议保留：

- 真实推进优先于表面顺滑
- 证据优先于感觉
- 根因优先于表象
- 结构化合作优先于单兵硬扛
- 长期稳定优先于短期丝滑

### 4. 长期禁止项

必须明确：

- 不能伪造完成
- 不能把猜测说成事实
- 不能为省事绕过治理面
- 不能凭方便扩张自己的 authority
- 不能在上下文明显劣化时盲目前进

### 5. 长期恢复性与 continuation 纪律

必须明确：

- 保持可继续
- 保持可验证
- 保持可治理
- 保持可交接
- 保持不污染未来上下文

## 四、`core-system/v1` 明确不应包含什么

下面这些东西不应进入 `core-system/v1`。

### 1. 当前回合现场

例如：

- 最新用户消息
- 当前 transcript
- 当前任务目标
- 当前仓库路径
- 当前 worktree / branch

这些都属于 contextual。

### 2. 当前能力窗口

例如：

- 当前已注册 capability list
- 当前 TAP inventory
- 当前 capability usage index
- 当前具体 skill/mcp/tool 名称清单

这些属于 development 或 contextual。

### 3. 当前工具调用格式

例如：

- `shell.restricted` 的 JSON shape
- `browser.playwright` 的 action shape
- `search.ground` 的 input schema
- `request_permissions` / `request_user_input` 的具体 payload 格式

这些属于 development。

### 4. 当前 harness / 宿主细节

例如：

- `Praxis live CLI harness`
- 当前 CLI mode / TUI mode
- 当前 provider 兼容说明
- 当前 stream/fallback 规则

这些属于 development。

### 5. 当前治理状态

例如：

- 当前 approval 是否 pending
- 当前 readback/smoke gate 是否 degraded
- 当前 CMP package id

这些属于 contextual。

## 五、`core-development/v1` 的边界

`core-development/v1` 是当前最该工程化的一层。

它应吸收现在 `live-agent-chat.ts` 里散落的大量制度性文字。

### `core-development/v1` 应承载的制度

#### 1. 当前 objective 锚定纪律

包括：

- 当前目标优先
- 防止残余动量污染
- 先识别当前对象，再决定下一步

#### 2. `CMP / TAP / MP` 使用纪律

包括：

- 什么时候应该依赖 `CMP`
- 什么时候应该依赖 `TAP`
- 什么时候应该把 `MP` 视为记忆包治理面，而不是 raw history dump

#### 3. 执行纪律

包括：

- 默认真实推进，不停在分析层
- 尽量先做最小真实下一步
- 能直接读取真实代码就不要猜

#### 4. 验证纪律

包括：

- 先窄验证，再扩大
- 区分已实现 / 最小验证 / 目标验证 / 广泛验证
- 没验证就明确说没验证

#### 5. Blocked / Incomplete / Exhausted 语义

包括：

- 什么叫 `completed`
- 什么叫 `incomplete`
- 什么叫 `blocked`
- 什么叫 `exhausted`
- 什么时候该继续 capability loop

#### 6. Tool / capability 使用纪律

包括：

- capability 存在时不应假装自己不能行动
- capability inventory 的解释责任
- search / browser / shell / doc / spreadsheet 等当前 runtime 规则
- 单步 browser action discipline

#### 7. Harness 规则

包括：

- 当前 active execution loop 语义
- 当前 TAP governance mode
- 当前 direct answer / capability_call 决策规则

## 六、`core-context assembly` 应有哪些输入块

`core-contextual-user/v1` 推荐采用块化包结构，而不是一大段自然语言拼贴。

### 推荐块

```text
<core_contextual_user>
  <current_objective>...</current_objective>
  <recent_transcript>...</recent_transcript>
  <workspace_context>...</workspace_context>
  <cmp_context_package>...</cmp_context_package>
  <tap_capability_window>...</tap_capability_window>
  <capability_history>...</capability_history>
  <latest_tool_result>...</latest_tool_result>
  <grounding_evidence>...</grounding_evidence>
  <task_specific_constraints>...</task_specific_constraints>
</core_contextual_user>
```

### 块语义

#### `current_objective`

放：

- 当前用户这轮要解决什么
- 这轮成功条件是什么

#### `recent_transcript`

放：

- 最近几轮对话窗口
- 仅用于维持短链对话 continuity

#### `workspace_context`

放：

- 当前路径
- 当前仓库/分支/worktree
- 当前局部环境事实

#### `cmp_context_package`

放：

- `CMP active package summary`
- operator guide
- child guide
- checker reason
- package ref
- route rationale
- scope policy
- package/timeline strategy

#### `tap_capability_window`

放：

- 当前 capability inventory
- capability usage index
- 当前可直接用的治理窗口

#### `capability_history`

放：

- 本 turn 内已经拿到的多步 capability 结果历史

#### `latest_tool_result`

放：

- 最新一步工具返回
- 优先级高于更早的 capability history

#### `grounding_evidence`

放：

- 标准化的 browser/search/tool grounding evidence
- 例如 pages[] / facts[]

#### `task_specific_constraints`

放：

- 这轮额外范围限制
- 风险说明
- 明确非目标

## 七、当前 `live-agent-chat.ts` 里哪些文字应迁移到哪一层

下面只列最典型的迁移方向。

### A. 应保留在 system 层的

来源主要参考：

- `docs/ability/60-core-agent-system-prompt-draft.md`

包括：

- `core` 是主 agent，不是纯调度器
- `core` 与 `CMP/TAP/MP` 的长期关系
- 长期工作哲学
- 长期禁止项

### B. 应迁移到 development 层的

来自 `buildCoreUserInput(...)` 与 `buildCoreActionPlannerInstructionText(...)` 的这几大类内容：

#### 1. capability loop 规则

例如：

- “If the task is not yet complete and another registered capability can move it forward...”
- “Only stop and ask the user for help when...”

这些是运行制度，不是人格。

文件锚点：

- `src/agent_core/live-agent-chat.ts:546-566`
- `src/agent_core/live-agent-chat.ts:682-698`

#### 2. taskStatus 语义

例如：

- `completed|incomplete|blocked|exhausted` 的用法

这是 development 规则。

文件锚点：

- `src/agent_core/live-agent-chat.ts:553-561`
- `src/agent_core/live-agent-chat.ts:688-696`

#### 3. browser/search 特殊纪律

例如：

- 一次只发一个 browser action
- grounding evidence 的处理规则
- latest/current 在线信息优先 `search.ground`

这是 harness/runtime 规则。

文件锚点：

- `src/agent_core/live-agent-chat.ts:562-586`
- `src/agent_core/live-agent-chat.ts:701-713`

#### 4. capability inventory 使用规则

例如：

- capability 已存在时不要假装不能行动
- 不要用 mcp.* 去检查自己已经注册好的能力窗口

这是 capability governance 使用规则。

文件锚点：

- `src/agent_core/live-agent-chat.ts:547-549`
- `src/agent_core/live-agent-chat.ts:589-590`
- `src/agent_core/live-agent-chat.ts:693-699`

#### 5. 工具输入 schema 大段说明

例如：

- `shell.restricted` / `test.run` / `browser.playwright` / `search.*` / `doc.*` / `spreadsheet.*` 等结构化例子

这些不应进 system，也不该常驻 contextual。
它们应成为 development 的“capability formatting appendix”或独立 capability contract 视图。

文件锚点：

- `src/agent_core/live-agent-chat.ts:603-623`

#### 6. TAP governance mode 文案

例如：

- `TAP governance is configured in bapr + prefer_auto for this CLI.`

这是当前 harness 事实。

文件锚点：

- `src/agent_core/live-agent-chat.ts:543`
- `src/agent_core/live-agent-chat.ts:678`

### C. 应迁移到 contextual 层的

#### 1. 最新用户消息

文件锚点：

- `src/agent_core/live-agent-chat.ts:629-631`

#### 2. 最近对话窗口

文件锚点：

- `src/agent_core/live-agent-chat.ts:632-634`

#### 3. CMP active package summary

文件锚点：

- `src/agent_core/live-agent-chat.ts:517-541`
- `src/agent_core/live-agent-chat.ts:636`

#### 4. capability history

文件锚点：

- `src/agent_core/live-agent-chat.ts:638-643`

#### 5. latest tool result

文件锚点：

- `src/agent_core/live-agent-chat.ts:646-650`

#### 6. grounding evidence

文件锚点：

- `src/agent_core/live-agent-chat.ts:653-659`

#### 7. 当前 capability inventory 快照

当前 builder 把 capability window 同时当成制度和现场在写。

更合理的做法：

- “怎么使用 capability window” 留在 development
- “当前有哪些 capability” 放进 contextual

文件锚点：

- `src/agent_core/live-agent-chat.ts:504-510`
- `src/agent_core/live-agent-chat.ts:627`

## 八、最小迁移顺序

这部分最重要。

不要一口气把九个 agent 全部 prompt pack 化。

### 第一步：冻结 `core-system/v1` 规格

先把 system 层边界钉死。

产物：

- 本规格文档
- 后续正式 `core-system/v1` 文案草稿

### 第二步：提取 `core-development/v1`

从 `buildCoreActionPlannerInstructionText(...)` 和 `buildCoreUserInput(...)` 中抽出共同的制度层。

最小实现建议：

- 新建独立 builder 文件
- 暂不改 runtime 架构，只先改文案来源

建议文件：

- `src/agent_core/core-prompt-system.ts`
- `src/agent_core/core-prompt-development.ts`

### 第三步：提取 `core-context assembly`

把当前动态现场从自然语言大拼贴改成块装配。

最小实现建议：

- 先不改变最终仍然是字符串输入这件事
- 但内部先把数据组织成显式 blocks，再统一 render

建议文件：

- `src/agent_core/core-context-assembly.ts`

### 第四步：让 `buildCoreActionPlannerInstructionText(...)` 与 `buildCoreUserInput(...)` 调用统一装配层

也就是说：

- 不要求今天就把 OpenAI message roles 全部改成 system/developer/user 多消息
- 但至少先做到：层次在代码里真实存在

### 第五步：后续再考虑更深的 runtime 层接线

例如：

- 从单段 `instructionText` 走向显式 layered message assembly
- prompt telemetry 区分 system/development/contextual token 占比

## 九、最小工程接口建议

### `core-system/v1`

```ts
export interface CoreSystemPromptPack {
  promptPackId: "core-system/v1";
  text: string;
}
```

### `core-development/v1`

```ts
export interface CoreDevelopmentPromptInput {
  tapMode: string;
  automationDepth: string;
  uiMode?: string;
}

export interface CoreDevelopmentPromptPack {
  promptPackId: "core-development/v1";
  text: string;
}
```

### `core-context assembly`

```ts
export interface CoreContextAssemblyInput {
  userMessage: string;
  transcriptWindow: string;
  workspaceContext?: string;
  cmpContextPackage?: string;
  tapCapabilityWindow?: string;
  capabilityHistory?: string;
  latestToolResult?: string;
  groundingEvidence?: string;
  taskSpecificConstraints?: string;
}
```

## 十、验收标准

当这一层工程化完成时，至少应满足：

1. `core-system/v1` 可以单独读出，不再埋在手工字符串里。
2. `core-development/v1` 可以单独读出，不再散落在两个 builder 里。
3. `core-contextual-user/v1` 至少在代码内部是块化装配。
4. `buildCoreActionPlannerInstructionText(...)` 与 `buildCoreUserInput(...)` 都变成“装配器调用者”，而不是“所有文案都写在自己体内”。
5. 后续要替换 system/development/contextual 任一层时，不必整段重写主 builder。

## 十一、当前结论

Praxis `core` 的下一刀，不该是继续写更长的 prompt。

真正该做的是：

- 把长期宪法从现场制度里剥出来
- 把运行制度从动态上下文里剥出来
- 把动态现场做成可治理的装配块

一句收口：

Praxis `core` 的 prompt engineering，接下来应该从“写 prompt”进入“做 prompt assembly”。
