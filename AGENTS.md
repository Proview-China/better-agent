# Repository Guidelines / 仓库贡献指南

## 项目结构与模块组织
- `better-agent/core/` —— C++23 核心库与 C 接口，包含 `header/` 公共头文件、`cpp/` 实现、`tests/` 测试以及 `third-party/` 依赖。
- `better-agent/ui/gui/macOS/` —— 使用 SwiftUI 的 macOS 客户端（Xcode 工程）。
- `better-agent/ui/gui/other/` —— 为 Electron 客户端预留的 Node 端入口（依赖 N‑API 插件）。
- `better-agent/ui/tui/` —— 预留的终端界面实现目录。
- `docs/` —— 设计与架构文档，建议从 `docs/master.md` 开始阅读。

## 构建、测试与本地开发
- 构建核心库（Release + 启用测试）：
  - `cd better-agent/core`
  - `cmake --preset clang-release -D BUILD_TESTING=ON`
  - `cmake --build --preset build-clang-release`
- 构建 Node N‑API 插件：
  - `cmake --preset clang-release-node`
  - `cmake --build --preset build-clang-release-node`
- 运行 C++ 测试：
  - `cd build/clang-release`（或你配置的二进制目录）
  - `ctest` 或 `ctest -R agent_core_`
- 运行 macOS 客户端：使用 Xcode 打开  
  `better-agent/ui/gui/macOS/better-agent/better-agent.xcodeproj` 并运行 `better-agent` scheme（仅支持 arm64）。

## 代码风格与命名约定
- C++ 使用 C++23、4 空格缩进、禁止制表符；禁止 `#include <bits/stdc++.h>` 与全局 `using namespace`。
- 优先使用 RAII 与智能指针，避免裸 `new/delete`；对 `extern "C"` 导出的 API 不抛异常，使用错误码或标准化 JSON 错误返回。
- 宏需使用 `BETTER_AGENT_` 前缀；头文件必须包含 include guard。
- C 接口统一采用 `snake_case`（如 `agent_core_init`），类型名使用有意义的英文单词，不使用匈牙利命名。

## 测试规范
- 测试位于 `better-agent/core/tests/`，通过 CTest 注册为可执行测试。
- 使用 `tests/common/test_helpers.hpp` 中的 `expect` 与 `parse_json` 做断言与 JSON 解析。
- 测试可执行文件建议命名为单元测试 `agent_core_unit_*`，集成测试 `agent_core_integration_*`。
- 新增公共 API 或复杂逻辑必须配套测试，保持测试快速、稳定、可复现。

## 提交与 Pull Request 规范
- 提交信息应简短清晰，可使用中文，例如：`完善工具调用与自定义工具测试`。
- 同一提交只做一类改动（修复 / 重构 / 文档），避免混合无关更改。
- PR 中请说明动机、主要改动点与本地测试命令（如 `ctest`、Xcode 测试等），并在可能时关联 Issue。
- UI 相关改动建议附上前后对比说明或截图，便于审阅。

## Agent 交互说明
- 在本仓库中，默认与最终用户的交互（包括代码助手回复）应使用简体中文。
- 若需要使用其他语言，请在具体 Issue 或 PR 中显式约定。
