# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build

Core 使用 CMake 构建，最低要求 3.25，编译器需支持 C++23。

```bash
cd better-agent/core
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
```

构建 N-API addon（需要 cmake-js 和 Node headers）：
```bash
cmake .. -DCMAKE_BUILD_TYPE=Release -DBUILD_NODE_ADDON=ON
cmake --build .
```

## Architecture

**C++ core + 双绑定** 架构：

- `better-agent/core/` — C++23 共享库（`libagent_core.dylib`），通过 `extern "C"` 暴露 C API
- `core/bindings/swift/` — Swift modulemap，SwiftUI 侧通过 `import AgentCore` 调用
- `core/bindings/node/` — N-API addon（`agent_core.node`），供 Electron 调用

**UI 层**（`ui/`）：

- `ui/gui/macOS/` — SwiftUI 原生 macOS 客户端（Xcode 项目），通过 modulemap 调用 core
- `ui/gui/other/` — Electron 跨平台客户端（Node.js），通过 N-API addon 调用 core
- `ui/tui/` — 终端界面（预留）

公开 API 定义在 `core/header/agent_core.h`，实现在 `core/cpp/`。符号默认隐藏，仅 `AGENT_CORE_API` 标记的函数导出。

新增导出函数需要改三处：
1. `core/header/agent_core.h` — 在 `extern "C"` 块中用 `AGENT_CORE_API` 声明函数原型（Swift 侧通过 modulemap 自动可见，无需额外操作）
2. `core/cpp/` — 实现函数
3. `core/bindings/node/agent_core_napi.cpp` — 编写 N-API 包装并注册到 `props` 数组

## Code Rules

- 禁止使用 `#include <bits/stdc++.h>`，必须显式 include 所需的标准库头文件

## Platform

- macOS arm64 only
- 编译选项：C++23、无扩展、符号默认隐藏

## Deployment

推送到 `deploy` 分支触发 GitHub Actions 自动部署（SSH jump host 架构：香港中转 → 美国 VPS）。

## Branches

- `main` — 稳定分支
- `dev` — 开发分支
- `deploy` — 部署触发分支
