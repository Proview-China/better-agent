# Basic Implementation

## Positioning

本章定义 `rax` 的第一层能力模型。

这里不再使用旧的 `4+4` 粗分类，因为它把不同维度的概念混在了一层：
- 有些是模型能力。
- 有些是工具能力。
- 有些是资源能力。
- 有些是运行时治理能力。

`rax` 的目标不是把三家厂商的协议强行统一成一种格式，而是提供：
- 统一的开发者能力入口
- 正确的能力路由
- 保留各家 SDK 原生能力差异

白话说：
- 上层开发者写一次“我要什么能力”
- 底层运行时再把它路由到正确的 `provider + sdk layer + capability adapter`

---

## 1) Scope Boundary

- 本章定义的是 `rax` 的能力平面、能力词汇、路由边界与最小实现预想。
- 本章不试图抄写各家 REST 字段，也不替代 provider 官方文档。
- 本章只定义“infra 该怎么组织自己”，而不是限制上层业务怎么编排 agent。
- 本章默认 `api` 与 `agent` 是两种不同的 SDK 层，必须显式区分：
  - `api`：官方客户端层，偏直接平台能力调用。
  - `agent`：官方 agent runtime / orchestration 层，偏 loop、session、subagent、trace、guardrail。

---

## 2) Design Principles

### 2.1 Unified Entry, Not Unified Wire Format

- 我们统一的是“上层如何发起能力调用”，不是“底层协议长得一样”。
- 不能为了统一，把 Anthropic 的 `messages` 强行伪装成 OpenAI 的 `responses`。
- 也不能把 Gemini 的 `Interactions` 或 ADK workflow 硬压成别家的字段形状。

### 2.2 Capability-First

- `rax` 的第一视角应该是“能力”，不是“SDK 文件路径”。
- 开发者应表达：
  - 我想生成文本
  - 我想连 MCP
  - 我想恢复 session
  - 我想跑一个 agent
- 开发者不应表达：
  - 去 `openai/api/generation/responses` 调一个文件

### 2.3 Provider-Specific Lowering

- 所有统一调用最终都必须下沉到 provider-specific adapter。
- 最深处文件仍然保留各家原生 SDK 调用方式。
- 不允许为了表面整齐，把 provider 特有能力抹平到看不见。

### 2.4 Explicit Support Matrix

- 一样的能力要写出来。
- 不一样的能力也要写出来。
- 如果某个能力只有一家支持，也要保留统一动词，但文档与注册表必须说明支持矩阵。

---

## 3) Capability Planes

`rax` 建议把能力拆成四个平面，而不是一层混写：

### 3.1 Inference Plane

负责模型本身的推理与模态生成能力。

典型能力：
- `generation`
- `embeddings`
- `images`
- `audio`
- `moderation`
- `realtime/live`

### 3.2 Tool Plane

负责“模型借助工具完成任务”的能力。

典型能力：
- `tool`
- `search`
- `code`
- `computer`
- `shell`
- `mcp`

### 3.3 Resource Plane

负责资源管理、异步作业与检索底座。

典型能力：
- `file`
- `upload`
- `vector_store`
- `artifact`
- `model_registry`
- `batch`
- `fine_tuning`
- `context_cache`

### 3.4 Runtime Plane

负责 agent 系统本身的组织、治理与可观测性。

典型能力：
- `session`
- `agent`
- `guardrail`
- `memory`
- `trace`
- `callback`
- `skill`
- `plugin`
- `eval`
- `deployment`

---

## 4) Capability Pools

每个能力都应进入一个支持池。

### 4.1 Core Pool

定义：
- 三家都支持，或者都能稳定映射。

示例：
- `generate.create`
- `generate.stream`
- `embed.create`
- `tool.call`
- `file.upload`
- `batch.submit`

### 4.2 Shared Pool

定义：
- 只有两家稳定支持，或三家都能做但语义差异明显，不适合当作完全共通能力。

示例：
- `mcp.serve`
- `session.fork`
- `computer.use`
- `search.ground`

### 4.3 Provider Pool

定义：
- 只有一家支持，或只有一家做得完整。

示例：
- 某家独有的 hosted tool
- 某家独有的地图/深度研究类能力
- 某家独有的 agent runtime 扩展

注意：
- 进入 `provider` 池不代表不重要。
- 它只表示不能被假装成“所有厂商都一样”。

---

## 5) Capability Weight

每个能力都应标记厚薄程度。

### 5.1 Thin Capability

特点：
- 更接近 SDK 封装与参数适配。
- infra 主要工作是路由、校验、归一化、错误处理。

示例：
- `generate.create`
- `embed.create`
- `file.upload`
- `batch.submit`

### 5.2 Thick Capability

特点：
- 官方虽然给了入口，但我们自己的 infra 成本很高。
- 往往需要完整循环、状态管理、审批、安全与可观测支持。

示例：
- `computer.use`
- `code.run`
- `mcp.connect`
- `session.resume`
- `agent.handoff`
- `trace.start`

---

## 6) Unified Invocation Contract

`rax` 不需要统一底层协议，但需要统一“能力调用请求”和“能力调用结果”的外壳。

### 6.1 Unified Request

建议内部统一请求至少包含：
- `provider`：`openai | anthropic | deepmind | ...`
- `model`：模型标识
- `layer`：`api | agent | auto`
- `variant`：同一能力在同一 provider/layer 下存在多个 adapter 时的选择位
- `capability`：能力名，如 `generation`、`mcp`、`session`
- `action`：动词名，如 `create`、`call`、`resume`
- `input`：能力输入
- `session`：会话上下文
- `tools`：工具清单或工具上下文
- `policy`：权限、网络、目录、审批等策略
- `metadata`：额外标签与追踪信息
- `provider_options`：各家专属透传参数

### 6.2 Unified Result

建议内部统一结果至少包含：
- `status`：`queued | running | success | partial | failed | blocked | timeout`
- `provider`
- `model`
- `layer`
- `capability`
- `action`
- `output`
- `artifacts`
- `usage`
- `evidence`
- `error`
- `handoff`

关键点：
- 统一的是“结果外壳”，不是把所有 provider payload 压成一个假对象。
- 原始 provider 响应仍应保留在证据链中，便于审计与调试。

---

## 7) Canonical Capability Verbs

这些是建议的统一动词，不等于所有厂商都必须实现所有动词。

### 7.1 `generate`

作用：
- 统一文本/多模态生成入口。

建议动词：
- `create`
- `stream`
- `live`
- `structure`

默认层：
- `api`

支持池：
- `create` / `stream` 通常是 `core`
- `live` 多为 `shared`
- `structure` 通常是 `core`

厚薄：
- `create` / `stream` 偏 `thin`
- `live` 偏 `thick`

### 7.2 `embed`

作用：
- 统一向量化能力。

建议动词：
- `create`

默认层：
- `api`

支持池：
- `shared`

厚薄：
- `thin`

### 7.3 `tool`

作用：
- 统一广义 function/tool calling。

建议动词：
- `define`
- `list`
- `call`
- `result`

默认层：
- `api`

支持池：
- `core`

厚薄：
- `call` 常为 `thin`
- `result` 常为 `thin`
- 真正复杂的 loop 不在这里，而在 `agent`

### 7.4 `mcp`

作用：
- 统一 MCP 连接、工具发现、工具调用与暴露。

建议动词：
- `connect`
- `listTools`
- `call`
- `serve`

默认层：
- `auto`

支持池：
- `connect` / `call` 通常是 `shared`
- `serve` 通常是 `shared` 或 `provider`

厚薄：
- `thick`

说明：
- `mcp` 不是单纯一个工具，而是一类工具接入协议。
- 其本质更接近 `connector transport + tool runtime bridge`。

### 7.5 `search`

作用：
- 统一联网取证与来源接地能力。

建议动词：
- `web`
- `fetch`
- `ground`

默认层：
- `api`

支持池：
- `web` / `fetch` 多为 `shared`
- `ground` 多为 `shared` 或 `provider`

厚薄：
- `web` / `fetch` 偏 `thin`
- `ground` 偏 `thick`

当前阶段收口说明：
- 对上层，当前先收成一个自治入口：
  - `rax.websearch.create()`
- 对内部，仍保留 canonical 语义：
  - `search.web`
  - `search.fetch`
  - `search.ground`
- 当前最佳实践已经明确：
  - OpenAI：`responses + web_search`
  - Anthropic：`agent / Claude Code`
  - DeepMind / Gemini：`models.generateContent + googleSearch`
- 当前结论不是“任意上游和任意模型都等价可用”，而是：
  - 要按 `provider + upstream + model + layer` 组合声明支持矩阵
  - 对 unofficial / gateway upstream 继续通过 compatibility profile 收口

### 7.6 `code`

作用：
- 统一代码/脚本执行能力。

建议动词：
- `run`
- `patch`
- `sandbox`

默认层：
- `api` 或 `agent`

支持池：
- 多为 `shared`

厚薄：
- `thick`

说明：
- 真正的难点不在模型调用，而在沙箱、证据、回放与副作用控制。

### 7.7 `computer`

作用：
- 统一 GUI / 桌面 / 浏览器级动作能力。

建议动词：
- `use`
- `observe`
- `act`

默认层：
- `api` 或 `agent`

支持池：
- 多为 `shared`

厚薄：
- `thick`

说明：
- 它本质是“观察 -> 动作 -> 再观察”的闭环，不是单次函数调用。

### 7.8 `shell`

作用：
- 统一 shell 型工具执行。

建议动词：
- `run`
- `approve`

默认层：
- `api` 或 `agent`

支持池：
- 多为 `provider`

厚薄：
- `thick`

说明：
- shell 不应被视作简单文本工具，它天然带有高风险副作用。

### 7.9 `session`

作用：
- 统一会话生命周期管理。

建议动词：
- `open`
- `resume`
- `fork`
- `compact`
- `close`

默认层：
- `agent`

支持池：
- `open` / `resume` 多为 `shared`
- `fork` / `compact` 常为 `shared` 或 `provider`

厚薄：
- `thick`

### 7.10 `agent`

作用：
- 统一 agent 运行与多 agent 调度入口。

建议动词：
- `run`
- `delegate`
- `handoff`
- `asTool`

默认层：
- `agent`

支持池：
- `run` 通常是 `core`
- `delegate` / `handoff` 常为 `shared`
- `asTool` 常为 `shared`

厚薄：
- `thick`

### 7.11 `file`

作用：
- 统一平台文件资源能力。

建议动词：
- `upload`
- `list`
- `read`
- `remove`

默认层：
- `api`

支持池：
- `core`

厚薄：
- `thin`

### 7.12 `batch`

作用：
- 统一批量异步作业能力。

建议动词：
- `submit`
- `status`
- `cancel`
- `result`

默认层：
- `api`

支持池：
- `shared`

厚薄：
- `thin`

### 7.13 `trace`

作用：
- 统一运行链路追踪与关键事件记录。

建议动词：
- `start`
- `span`
- `event`
- `end`

默认层：
- `agent`

支持池：
- `shared`

厚薄：
- `thick`

---

## 8) Capability Catalog (Implementation Expectations)

下面给出每类能力的第一层预想。这里定义的是 infra 责任，而不是 provider 字段。

### 8.1 Inference Plane

`generation`
- 目标：统一文本/多模态生成入口。
- 必要能力：普通生成、流式生成、结构化输出、实时生成。
- 最小职责：
  - 处理输入标准化
  - 处理 provider 路由
  - 保留原始响应证据
  - 统一 usage / finish reason / error 映射

`embeddings`
- 目标：统一向量化入口。
- 最小职责：
  - 输入批量化
  - 向量结果映射
  - provider 不支持时明确失败

`images`
- 目标：统一图像生成与编辑入口。
- 最小职责：
  - 区分生成、编辑、变体
  - 管理图像输入输出产物
  - 记录产物路径与来源

`audio`
- 目标：统一语音生成、转写、翻译入口。
- 最小职责：
  - 区分 `speech`、`transcription`、`translation`
  - 记录文件类型与产物元数据

`moderation`
- 目标：统一安全审查入口。
- 最小职责：
  - 返回分类结果
  - 提供审查证据与判定理由

### 8.2 Tool Plane

`tool`
- 目标：统一 function/tool calling 的注册与执行。
- 最小职责：
  - 工具 schema 注册
  - 参数校验
  - 工具结果回灌
  - 工具执行证据记录

`search`
- 目标：统一联网取证流程。
- 最小职责：
  - 查询构建
  - 来源治理
  - 结果去重与时效判断
  - 返回可引用证据集

`code`
- 目标：统一代码/脚本执行。
- 最小职责：
  - 代码隔离执行
  - 产物管理
  - stdout/stderr/exit_code 统一收集
  - 高风险副作用控制

`computer`
- 目标：统一观察-动作闭环。
- 最小职责：
  - 观察接口
  - 动作接口
  - 循环状态判断
  - 屏幕证据与动作日志

`shell`
- 目标：统一 shell 调用与审批。
- 最小职责：
  - 命令审批
  - 工作目录限制
  - 命令输出捕获
  - 副作用摘要

`mcp`
- 目标：统一 MCP 消费与暴露。
- 最小职责：
  - server 连接
  - tool 发现
  - tool 调用
  - 协议/鉴权/网络错误分类

### 8.3 Resource Plane

`file`
- 目标：统一平台文件资源管理。
- 最小职责：
  - 上传
  - 列表
  - 读取
  - 删除

`upload`
- 目标：统一大文件/分片上传。
- 最小职责：
  - 分片状态管理
  - 上传失败恢复

`vector_store`
- 目标：统一检索底座能力。
- 最小职责：
  - store 创建与关联
  - 文档接入状态
  - 检索元数据桥接

`artifact`
- 目标：统一会话或任务级产物。
- 最小职责：
  - 产物持久化
  - 生命周期与归属
  - 会话/用户范围隔离

`model_registry`
- 目标：统一 provider 模型能力视图。
- 最小职责：
  - 模型枚举
  - 能力标记
  - 路由前校验

`batch`
- 目标：统一批量异步作业。
- 最小职责：
  - 提交
  - 状态轮询
  - 结果回收
  - 失败归因

`fine_tuning`
- 目标：统一训练/微调作业入口。
- 最小职责：
  - 训练任务状态管理
  - 产物模型记录
  - 异常状态回读

`context_cache`
- 目标：统一缓存型上下文能力。
- 最小职责：
  - 缓存创建
  - 生命周期管理
  - 命中率与收益评估

### 8.4 Runtime Plane

`session`
- 目标：统一长生命周期对话/agent 会话。
- 最小职责：
  - 开启
  - 恢复
  - fork
  - compact
  - close

`agent`
- 目标：统一 agent 运行与任务转交。
- 最小职责：
  - agent 启动
  - handoff/delegate
  - agent-as-tool
  - 任务级证据回收

`guardrail`
- 目标：统一输入/输出/工具治理。
- 最小职责：
  - 调用前校验
  - 调用后审查
  - 拦截与阻断
  - 风险分级

`memory`
- 目标：统一记忆读写。
- 最小职责：
  - 记忆写入
  - 记忆检索
  - 冲突处理
  - 时效治理

`trace`
- 目标：统一链路追踪。
- 最小职责：
  - trace/span/event 生命周期
  - 调用链证据
  - provider 原始事件关联

`callback`
- 目标：统一运行时前后钩子。
- 最小职责：
  - 前置/后置拦截
  - 中断或降级
  - 事件注入

说明：
- 旧 `hooks` 不再作为独立工具能力看待。
- 它应降级为 runtime callback / governance 机制的一部分。

`skill`
- 目标：统一能力包装与分发单元。
- 最小职责：
  - 版本化技能描述
  - 装载策略
  - 上下文注入
  - 命中与收益记录

说明：
- `skill` 不再被视作单次工具调用。
- 它属于 runtime plane 的扩展机制。

`plugin`
- 目标：统一 provider 或宿主扩展单元。
- 最小职责：
  - 插件注册
  - 生命周期
  - 权限边界

`eval`
- 目标：统一评测入口。
- 最小职责：
  - 评测执行
  - 结果记录
  - 回归对比

`deployment`
- 目标：统一 agent/runtime 部署承接面。
- 最小职责：
  - 本地运行承接
  - 远程承接
  - 配置注入
  - 运行环境约束

---

## 9) Routing Rules

### 9.1 Auto Layer Is Allowed

- 某些能力不应要求上层每次手动决定 `api` 还是 `agent`。
- 因此 `layer` 应支持：
  - `api`
  - `agent`
  - `auto`

### 9.1.1 Variant Selection Is Allowed

- 某些 provider 会在同一个 `capability + action + layer` 下提供多条实现路径。
- 例如：
  - OpenAI `generate.create` 既可能走 `responses`
  - 也可能走 `chat_completions_compat`
- 因此统一请求应允许 `variant` 选择位。
- 若未指定 `variant`，运行时应优先走默认 adapter。

### 9.2 Route by Capability, Not by File Path

- 上层调用应表达：
  - `provider`
  - `model`
  - `capability`
  - `action`
- 运行时再决定落到哪个 adapter 文件。

### 9.3 Preserve Escape Hatches

- 必须允许 provider 专属参数透传。
- 不能让统一入口成为最小公分母陷阱。

---

## 10) Safety Baseline

- 默认最小权限：无隐式高权限、无隐式网络放行。
- 高风险能力必须可拦截：尤其是 `shell`、`computer`、`code`、`mcp`。
- 所有能力调用必须可审计、可中断、可回放。
- provider 返回与运行时结论冲突时，以运行时证据链为准并显式记录差异。

---

## 11) Acceptance (M0)

第一阶段不追求“所有能力全部接完”，而追求能力框架可持续。

`M0` 验收建议：
- `rax` 至少有一套稳定的统一能力词汇。
- 每个能力都有：
  - 所属 plane
  - 所属 support pool
  - 薄厚标记
  - 默认 layer
- 至少四类能力完成最小打通：
  - `generate.create`
  - `embed.create`
  - `mcp.connect`
  - `session.open`
- 每次失败都能返回：
  - provider
  - layer
  - capability
  - action
  - error
  - evidence

---

## 12) Main/Sub-Agent Role Boundary (Brief)

本章只保留与基础实现直接相关的边界。

`Main Agent`
- 偏策略、调研、编排、能力选择、上下文分配。

`Sub-Agent`
- 偏执行、编码、取证、反馈。

边界结论：
- 主子 agent 的差别不应体现在“提示词轻重”，而应体现在：
  - 能力边界
  - 工具组
  - 会话策略
  - 记忆注入
  - 审批与回传方式

---

## 13) Immediate Build Order

从薄能力开始，而不是从最炫的能力开始。

建议顺序：
1. `generate.create`
2. `generate.stream`
3. `embed.create`
4. `file.upload`
5. `batch.submit`
6. `mcp.connect`
7. `session.open`
8. `agent.run`

说明：
- `computer.use`、`code.run`、`session.resume`、`agent.handoff` 都属于厚能力，应在路由与证据模型稳定后再做。
