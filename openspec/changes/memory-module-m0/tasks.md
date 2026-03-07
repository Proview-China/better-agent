## 1. 数据模型与接口

- [x] 1.1 设计 memory entry、query result 与错误对象的统一 JSON 合约，并落实到 `better-agent/core/header/agent_core.h`
- [x] 1.2 设计 memory 配置、store 路径、注入上限与查询参数模型，并补充到 core 内部结构中

## 2. Store 与写入链路

- [x] 2.1 实现 `Memory Ingestor` 与 `Memory Normalizer`，支持执行记录输入与结论输入
- [x] 2.2 实现本地持久化的 `Memory Store` 与启动恢复逻辑，支持分层存储与同类条目更新

## 3. 检索与保护

- [x] 3.1 实现 `Memory Retriever`，支持按意图、主题、作用域、layer 的可解释检索
- [x] 3.2 实现 `Memory Guard`，处理过期、冲突、低置信条目与注入裁剪

## 4. 对外暴露与绑定

- [x] 4.1 在 core 中新增 memory 相关 C API，并保证 JSON 输入输出与错误模型一致
- [x] 4.2 补充 Node binding 的薄封装，确保 UI 可直接调用 core memory 接口而不承载业务逻辑

## 5. 验证

- [x] 5.1 为记忆写入、恢复、同类更新、冲突处理与过期过滤补单元测试
- [x] 5.2 为可解释检索、注入上限与 binding 透传行为补单元测试
