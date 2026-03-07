## 上下文

当前 `better-agent/core` 已经具备运行时归一化、工具执行记录与 provider 包装能力，但这些能力只解决“本次执行发生了什么”，没有解决“哪些结论值得长期复用”。文档中要求的 Memory M0 包括 `Memory Ingestor`、`Memory Normalizer`、`Memory Store`、`Memory Retriever` 与 `Memory Guard`，而仓库里当前还没有对应的数据模型、持久化、检索或对外 API。

另一个关键约束是：本项目中的 core 是内核，负责向 UI 暴露稳定接口。为了保证逻辑一致，memory 的归一化、冲突处理、检索排序与注入裁剪必须放在 `better-agent/core`，不能把同一套规则拆散到 `ui/gui/macOS/`、后续 Electron UI 或 TUI 中重复实现。

## 目标 / 非目标

**目标：**
- 在 `better-agent/core` 中建立 Memory M0 最小闭环：`ingest -> normalize -> store -> retrieve -> guard`
- 定义统一 memory entry 数据模型与本地持久化格式
- 提供可解释检索与注入上限控制
- 提供面向 UI 的稳定 C API / JSON 接口，并保持 binding 层为薄封装
- 补齐单元测试，验证写入可追踪、检索可解释、冲突可处理、注入可控

**非目标：**
- 不实现向量数据库、embedding 检索或云同步
- 不实现 UI 侧的复杂记忆管理面板
- 不实现多进程共享存储、远程 memory service 或分布式冲突解决
- 不把记忆决策逻辑下放到 UI

## 决策

### 1. 记忆能力完全下沉到 core

Memory M0 的决策逻辑全部放在 `better-agent/core`。UI 只提交原始输入和查询参数，core 返回标准化写入结果、检索结果与错误对象。这样可以保证 macOS / Electron / TUI 调用同一套规则，不会出现不同 UI 端行为漂移。

### 2. 使用统一 memory entry 数据模型

每条记忆使用统一结构，至少包含：
- `memory_id`
- `topic`
- `kind`
- `layer`
- `scope`
- `summary`
- `evidence`
- `confidence`
- `created_at`
- `updated_at`
- `expires_at`
- `status`
- `supersedes`
- `conflicts_with`

这样可以同时服务写入、检索、冲突处理与 UI 展示，而无需 UI 自行拼结构。

### 3. M0 采用“本地文件持久化 + 内存索引”

为了避免现在引入额外数据库依赖，M0 先采用 core 可直接控制的本地文件持久化格式，例如单一 JSON 文档或等价的稳定文件结构；启动时加载到内存索引，写入时由 core 统一更新并落盘。这种方案测试简单、依赖少，也便于 UI 通过 core API 使用。

### 4. Ingestor 先支持两类输入源

M0 先接入两类输入：
- 执行记录输入：从 execution record 中提取高价值事实、策略和失败经验
- 结论输入：来自人工确认或系统总结的高价值摘要

其他更复杂来源可以后续扩展，但 M0 先把输入面控制在可测范围。

### 5. Retriever 采用可解释规则检索

M0 检索不引入向量召回，而是按：
1. `intent/topic/scope/layer` 过滤
2. `confidence/freshness/evidence completeness` 排序
3. `max_entries/max_chars` 裁剪

同时返回命中原因与是否裁剪的信息，保证上层可解释。

### 6. Guard 在写入和读取两侧工作

- 写入侧：识别同类记忆，优先更新、合并或 supersede
- 读取侧：过滤过期条目、降权低置信条目、处理冲突状态

这样既避免 store 膨胀，也避免把脏数据直接注入上层。

### 7. 对外接口优先 JSON in/out

memory API 继续沿用现有 core 风格：C 兼容签名，JSON 字符串作为输入输出。推荐新增：
- `agent_core_memory_configure`
- `agent_core_memory_ingest`
- `agent_core_memory_query`
- `agent_core_memory_get`
- `agent_core_memory_reset`

Node binding 只做字符串透传和方法暴露，不重写逻辑。

## 风险 / 权衡

- 文件持久化在大规模数据下不如数据库，但对 M0 足够简单稳定
- 规则检索比向量召回弱，但更可解释、易测试，也更适合当前阶段
- 若一开始暴露过多 memory API，后续收敛成本会变高；因此 M0 应优先提供最小但完整的接口集合
- 如果允许 UI 自己做二次排序或冲突判断，短期看灵活，长期会破坏跨 UI 一致性，因此本轮必须严格约束
