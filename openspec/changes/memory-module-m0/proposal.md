## 为什么

`Memory Module` 是 `/Users/shiyu/Documents/Project/better-agent/docs/ability/01-basic-implementation.md` 中当前优先级最高的基础能力，但仓库现状只具备执行记录查询与运行时归一化，还没有“可复用事实 / 策略 / 失败经验”的统一沉淀与检索机制。结果是 core 能知道“刚刚执行了什么”，却不能把高价值结论整理成可复用、可解释、可裁剪的记忆条目。

现在推进这项变更，是为了把记忆能力下沉到 `better-agent/core`，形成稳定的内核接口，供 macOS UI、后续 Electron UI 与 TUI 统一调用。为了保证逻辑一致性，本轮要明确：记忆归一化、冲突处理、检索排序与注入裁剪都必须在 core 内实现，而不是分散到 UI 层。

## 变更内容

- 在 `better-agent/core` 中实现 Memory M0 闭环：`ingest -> normalize -> store -> retrieve -> guard`。
- 引入统一的 memory entry 数据模型，支持主题、作用域、证据锚点、置信度、时效、冲突关系与分层存储类别。
- 提供本地持久化的 Memory Store 与内存索引，支持 core 重启后恢复。
- 提供可解释的 Memory Retriever，支持按任务意图、主题、作用域查询，并在 core 内完成排序与注入裁剪。
- 提供面向 UI 的稳定 C API / JSON 接口，让 UI 只负责提交原始输入和展示结果，不承担记忆决策逻辑。
- 补充 Node binding 与 C++ 测试，验证写入可追踪、检索可解释、冲突可处理、注入可控。

## 功能 (Capabilities)

### 新增功能
- `memory-ingestion-and-store`: 定义记忆输入归一化、条目结构、分层存储与持久化行为。
- `memory-retrieval-and-guard`: 定义可解释检索、冲突处理、过期处理与注入上限控制。
- `memory-core-api`: 定义供 UI 调用的 core 侧记忆接口，并明确记忆决策逻辑不得下放到 UI。

### 修改功能
- 无

## 影响

- 受影响代码主要位于 `better-agent/core/header/agent_core.h`、`better-agent/core/cpp/internal/`、`better-agent/core/cpp/agent_core.cpp`、`better-agent/core/bindings/node/agent_core_napi.cpp` 与 `better-agent/core/tests/`。
- 本轮会新增 core 内部记忆数据模型、持久化文件格式与对外 API，但不实现向量数据库、云同步或多进程共享内存。
- UI 层只消费 core 暴露的 JSON 接口，本轮不把记忆排序、冲突决策或注入裁剪逻辑放到 `ui/gui/macOS/`、`ui/gui/other/` 或 `ui/tui/`。
