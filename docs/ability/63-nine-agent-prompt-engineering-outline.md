# Nine-Agent Prompt Engineering Outline

## Purpose

这份文档不是九个 agent 的最终 `system_prompt` 成稿。

它的作用是先把这轮 prompt engineering 的统一锚点钉死，避免后面的 `core + TAP + CMP` 九个 agent 各写各的、最后互相打架。

一句白话：

- 先定义“九个人到底处在什么关系里”
- 再分别写各自的 prompt

## Architectural Anchor

### 1. `core` 的真实身份

- `core` 不是纯 orchestrator。
- `core` 是真正负责完成项目任务的主 agent。
- `core` 应该具备接近 Codex 一类 coding agent 的工作面：
  - 读代码
  - 写代码
  - 调工具
  - 推进任务
  - 承接长链路工程工作

一句白话：

- `core` 是真正下场干活的人

### 2. `CMP + TAP + MP` 的真实身份

- `CMP`
  - 是围绕 `core` 提供上下文管理、任务背景整理、信息分层、上下文新鲜度维护的控制域
- `TAP`
  - 是围绕 `core` 提供治理、权限、能力交付、安全边界、审批和 handoff 的控制域
- `MP`
  - 是未来围绕 `core` 提供更完整多 agent 编排、记忆拓扑、控制结构的控制域

一句白话：

- `CMP/TAP/MP` 不是替 `core` 干主任务
- 它们是让 `core` 更强、更稳、更可控的服务层

### 3. `core` 同时是“老板”也是“打工人”

- `core` 是老板：
  - 因为真正对任务结果负责的是它
- `core` 是打工人：
  - 因为它必须不断向 `CMP/TAP/MP` 取上下文、取治理结果、取能力、取授权

一句白话：

- `core` 不是一家独大
- 也不是纯被动木偶
- 它是主 agent，但被控制面持续拆解、拼接、供给、约束

## Prompt Engineering Order

### Stage 1: `core`

先定义 `core` 的主 agent 宪法：

- 它到底是什么
- 它怎样工作
- 它不能绕过什么
- 它怎样向 `CMP/TAP/MP` 请求服务

### Stage 2: TAP 3 agents

再定义：

- `reviewer`
- `tool_reviewer`
- `TMA / provisioner`

重点不是“它们也很能干”，而是：

- 它们怎样把治理、安全、能力交付做成对 `core` 的稳定服务

### Stage 3: CMP 5 agents

最后定义：

- `icma`
- `iterator`
- `checker`
- `dbagent`
- `dispatcher`

重点是：

- 它们怎样把 `core` 的上下文与任务推进面维持在高信噪比
- 尤其要突出 `dbagent` 的中心地位

## Shared Design Rules

所有九个 agent 的 prompt 起草都要遵守：

1. 不把 `core` 写成纯调度器。
2. 不把 `CMP/TAP/MP` 写成压制 `core` 的“上级老板”。
3. 所有控制域都必须体现“服务 core，但也约束 core”。
4. 每个 agent 都要明确：
   - 身份
   - 服务对象
   - 职责边界
   - 禁止项
   - handoff 对象
5. prompt 不是只写风格口号，必须直接服务 runtime contract。
6. 先允许长 prompt，再逐轮压缩；这一轮不以 token 节省为主要目标。

## Deliverables

这一轮至少产出三份草案：

- `60-core-agent-system-prompt-draft.md`
- `61-tap-three-agent-system-prompt-draft.md`
- `62-cmp-five-agent-system-prompt-draft.md`

后续再由用户逐轮把关，把三份草案收敛成真正可接入代码的 prompt catalog。
