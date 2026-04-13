# Core Prompt Assembly v0 Design

状态：设计稿 / 对应 `core-system-v1 engineering spec` 的最小代码落地方案。

更新时间：2026-04-12

## 当前唯一目标

在不碰脏主链文件的前提下，先把 `core` 的提示词工程做成一组可独立存在、可测试、可后续接线的模块。

这次不做的事：

- 不直接改 `live-agent-chat.ts`
- 不直接把 system/development/contextual 全接进模型调用链
- 不重做 `runtime.ts`

## 设计原则

### 1. 先把层建出来

哪怕现在最终模型调用仍然是单段 `instructionText`，也要先让三层在代码里真实存在：

- `core-system`
- `core-development`
- `core-contextual`

### 2. 先对象化，再渲染

尤其是 contextual 层。

不要继续直接手拼一大段字符串，而是：

1. 先组装结构化对象
2. 再统一 render 成 prompt 文本

### 3. 尽量不碰脏文件

本轮新增独立模块即可。
后续要接线时，再用最小 patch 接到 `live-agent-chat.ts`。

## 最小文件结构

建议先新增：

```text
src/agent_core/core-prompt/
  types.ts
  system.ts
  development.ts
  contextual.ts
  index.ts
  contextual.test.ts
```

## 每个文件负责什么

### `types.ts`

定义三层 prompt 的稳定类型。

至少包括：

- `CorePromptPackId`
- `CoreSystemPromptPack`
- `CoreDevelopmentPromptPack`
- `CoreContextualUserV1`
- `CoreContextualBlock`

### `system.ts`

只负责：

- `core-system/v1` 正式文本
- 对应 pack metadata

它不接收当前回合输入。

### `development.ts`

负责：

- `core-development/v1` 的制度文本
- 小范围 runtime facts 注入

例如：

- `tapMode`
- `automationDepth`
- `uiMode`

但不接收用户现场。

### `contextual.ts`

负责：

- `CoreContextualUserV1` 的对象结构
- 把对象渲染成稳定的块化 prompt 文本

这层是后续最重要的迁移桥。

### `index.ts`

统一导出。

## 建议导出的最小接口

### `types.ts`

```ts
export type CorePromptPackId =
  | "core-system/v1"
  | "core-development/v1"
  | "core-contextual-user/v1";

export interface CoreSystemPromptPack {
  promptPackId: "core-system/v1";
  text: string;
}

export interface CoreDevelopmentPromptPack {
  promptPackId: "core-development/v1";
  text: string;
}

export interface CoreContextualTextBlock {
  heading: string;
  body: string;
}
```

### `system.ts`

```ts
export function createCoreSystemPromptPack(): CoreSystemPromptPack;
export const CORE_SYSTEM_PROMPT_V1_TEXT: string;
```

### `development.ts`

```ts
export interface CoreDevelopmentPromptInput {
  tapMode: string;
  automationDepth: string;
  uiMode?: string;
}

export function createCoreDevelopmentPromptPack(
  input: CoreDevelopmentPromptInput,
): CoreDevelopmentPromptPack;
```

### `contextual.ts`

```ts
export interface CoreContextualUserV1 {
  currentObjective: string;
  recentTranscript: string;
  workspaceContext?: string;
  cmpContextPackage?: string;
  tapCapabilityWindow?: string;
  capabilityHistory?: string;
  latestToolResult?: string;
  groundingEvidence?: string;
  taskSpecificConstraints?: string;
}

export function renderCoreContextualUserV1(
  input: CoreContextualUserV1,
): string;
```

## 与当前主链的关系

### 现在

当前主链里最重的两个 builder 是：

- `buildCoreUserInput(...)`
- `buildCoreActionPlannerInstructionText(...)`

它们现在同时承载：

- system 级身份提醒
- development 级制度提醒
- contextual 级现场材料

### 这轮设计后的第一步关系

先不改主链行为，只建立替代来源：

- `system.ts` 提供 system 正文
- `development.ts` 提供制度正文
- `contextual.ts` 提供现场 render

之后再把原 builder 一点点换成：

- 调用 pack / render 函数
- 自己不再手写长文本

## 最小迁移顺序

### Step 1

先让 `contextual.ts` 落地。

原因：

- 它最容易对象化
- 收益最大
- 风险最小

### Step 2

让 `system.ts` 落地。

原因：

- 它最稳定
- 不依赖当前脏主链

### Step 3

让 `development.ts` 落地。

原因：

- 这一步文本最厚
- 但也最值得后续接入

### Step 4

后续再改 `live-agent-chat.ts`：

- `buildCoreUserInput(...)`
  改成从 `development + contextual` 取文本
- `buildCoreActionPlannerInstructionText(...)`
  也改成从 `development` 取制度块

## 最适合先补的测试

### 1. contextual render

测试：

- 能正确渲染必填块
- 可选块缺失时不输出空块
- 输出顺序稳定

### 2. system pack

测试：

- `promptPackId` 正确
- 文本包含长期身份锚点
- 不包含明显 runtime/schema 话术

### 3. development pack

测试：

- 会把传入的 runtime facts 渲染进 runtime-facts block
- 仍保留稳定制度正文

## 这轮设计的边界

这轮设计不解决：

- 多 message role 注入
- prompt token telemetry 按层拆账
- 与 `executeModelInference()` 的显式 system/developer/user message 对接

这些属于下一阶段。

## 一句收口

`core prompt assembly v0` 的目标不是立刻重写主运行链，而是先把三层变成真实代码对象。

只有这样，后面的接线才不会继续在两大坨字符串里打补丁。  
