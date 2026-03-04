# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build

Core 使用 CMake 构建，最低要求 3.25，编译器需支持 C++23。
本仓库默认使用 **clang/clang++**（通过 `CMakePresets.json` 固定）。

```bash
cd better-agent/core
cmake --preset clang-release
cmake --build --preset build-clang-release
```

构建 N-API addon（需要 cmake-js 和 Node headers）：
```bash
cmake --preset clang-release-node
cmake --build --preset build-clang-release-node
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

## Dependencies

第三方依赖统一放在 `core/third-party/`：

- `cpp-ai-sdk/` — [olrea/openai-cpp](https://github.com/yuemingruoan/cpp-ai-sdk)（git submodule），内部自带 nlohmann/json 副本
- `nlohmann/json.hpp` — 项目自身使用的 nlohmann/json 单头文件，与 openai-sdk 内置的互相独立
- **libcurl** — 网络请求库（SSE、WebSocket、流式传输），通过 CMake `find_package(CURL)` 引入。macOS/Linux 使用系统动态库，Windows 静态链接

项目代码用 `#include "json.hpp"`，`cpp-ai-sdk` 用它自己的副本，互不干扰。

## Code Rules

- 禁止使用 `#include <bits/stdc++.h>`和`import std`，必须显式 include 所需的标准库头文件
- 禁止在文件作用域中使用`using`语句，导入命名空间（例如`using namespace std`）和具体变量(例如`using std::cout`)均为禁止行为,但允许在函数作用域内（**main函数除外**）使用
- 对于有默认值语意的类，必须**显式定义**默认构造函数
- 优先使用`RAII`和`智能指针（std::unique_ptr、std::shared_ptr）`，避免裸指针和手动`new/delete`  
- 使用`extern "C"`导出的API必须拥有配对的释放函数
- 使用`extern "C"`导出的API**禁止直接抛出异常**，必须在边界处捕获所有异常，转而用错误码返回
- 代码中尽量避免使用异常，而是使用`std::expected`和`std::unexpected`代替
- 使用`extern "C"`导出的API**仅允许使用**C兼容类型（例如不应使用`std::string`,而是使用`const char*`）
- 实现文件必须先包含对应头文件
- 尽量避免使用宏，若必须使用，需添加`BETTER_AGENT`前缀，避免冲突
- 禁止在头文件中定义`inline`函数
- 符号导出遵循`最小可见性`，内部符号不得被导出
- 头文件必须包含`include guard`(例如`#pragma once`或`#ifndef`)
- **禁止使用**`匈牙利命名法`和无意义的缩写
- 禁止忽略函数返回值（使用`[[nodiscard]]`标记关键函数）
- 优先使用`auto`进行类型推导
- 编译期常量应使用`constexpr`和`consteval`进行标记
- 优先使用范围for代替手写索引，避免越界错误
- 优先使用`结构化绑定`(例如`auto [key, value] = map.find(...)`) 代替`it->first`


## Platform

- macOS arm64 only
- 编译选项：C++23、无扩展、符号默认隐藏

## Deployment

推送到 `deploy` 分支触发 GitHub Actions 自动部署（SSH jump host 架构：香港中转 → 美国 VPS）。

## Branches

- `main` — 稳定分支
- `dev` — 开发分支
- `deploy` — 部署触发分支
