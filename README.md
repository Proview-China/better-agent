# Praxis

Praxis 是一个基于 Swift + SwiftPM 的本地 agent runtime framework。仓库当前主线不是 CLI、TUI 或 GUI，而是一组可嵌入、可测试、可导出的 runtime products，用来承载 run lifecycle、capability governance、project context、memory retrieval 和 host export boundary。

对大多数 Swift 调用方，默认公开入口是 `PraxisRuntimeKit`。
当前仓库推进节奏与阶段顺序，统一以 [TAKEOVER_EXECUTION_WORKFLOW.md](/Users/shiyu/Documents/Project/Praxis/TAKEOVER_EXECUTION_WORKFLOW.md) 为准。

## Quick Start

先编译并运行 RuntimeKit 示例：

```bash
swift run PraxisRuntimeKitRunExample
swift run PraxisRuntimeKitCmpTapExample
swift run PraxisRuntimeKitMpExample
```

这三条示例直接提炼自 `PraxisRuntimeKitTests` 中已验证的真实路径：

- `PraxisRuntimeKitRunExample`
  展示 `runs.run(...)` 与 `runs.resumeRun(...)`。
- `PraxisRuntimeKitCmpTapExample`
  展示 project-scoped CMP approval 与 TAP overview。
- `PraxisRuntimeKitMpExample`
  展示 MP overview、search、resolve、history。

当前这些 examples 依赖本地 baseline host adapters，默认按 macOS 本地运行验证。
Linux 路径当前只保留 compile-safe placeholder 和条件编译接缝，待 macOS 实现完备后再推进兼容实现。

## Technical Overview

Praxis 当前的设计目标是把运行时拆成边界明确的 Swift package products，而不是把所有能力堆进一个粗粒度模块。

核心技术方向：

- 以 SwiftPM products 组织运行时能力
- 以 `PraxisRuntimeKit` 暴露 caller-friendly API
- 以 host contracts 隔离 provider、workspace、tooling、infra、user I/O 等宿主能力
- 以 runtime composition / facade / gateway / FFI 承担装配与导出责任
- 以 architecture tests 约束 target 边界，避免能力重新塌回“大模块”

## Product Surface

`Package.swift` 当前公开了这些 library products：

- `PraxisFoundation`
  基础领域模型，包括 core identity、goal、state、transition、run、session、journal、checkpoint。
- `PraxisCapabilityDomain`
  capability contract、planning、result normalization、catalog。
- `PraxisTapDomain`
  capability governance、review、provision、runtime availability。
- `PraxisCmpDomain`
  project context、approval、projection、delivery，以及 Git / DB / MQ 相关模型。
- `PraxisMpDomain`
  memory、search、resolve、history 相关模型与服务。
- `PraxisHostContracts`
  provider、workspace、tooling、infra、user I/O 协议层。
- `PraxisHostRuntime`
  runtime composition、use cases、facades、interface、gateway、FFI。
- `PraxisRuntimeKit`
  面向调用方的高层 Swift API。
- `PraxisArchitectureTests`
  用于验证 target 拆分与依赖方向的测试 product。

如果你只是要接入运行时，不需要先理解全部 products；优先从 `PraxisRuntimeKit` 开始。

## Runtime Layering

当前仓库可以粗分为四层：

1. Foundation / Domain
   - `PraxisCoreTypes`
   - `PraxisGoal`
   - `PraxisState`
   - `PraxisTransition`
   - `PraxisRun`
   - `PraxisSession`
   - `PraxisJournal`
   - `PraxisCheckpoint`

2. Capability / Workflow Domain
   - `PraxisCapabilityContracts`
   - `PraxisCapabilityPlanning`
   - `PraxisCapabilityResults`
   - `PraxisCapabilityCatalog`
   - `PraxisTap*`
   - `PraxisCmp*`
   - `PraxisMp*`

3. Host Boundary
   - `PraxisProviderContracts`
   - `PraxisWorkspaceContracts`
   - `PraxisToolingContracts`
   - `PraxisInfraContracts`
   - `PraxisUserIOContracts`

4. Runtime Assembly / Export
   - `PraxisRuntimeComposition`
   - `PraxisRuntimeUseCases`
   - `PraxisRuntimeFacades`
   - `PraxisRuntimeInterface`
   - `PraxisRuntimeGateway`
   - `PraxisFFI`
   - `PraxisRuntimeKit`

约束上，`PraxisRuntimeKit` 应该保持 thin shell，不直接把 composition、transport、bootstrap 或 FFI 细节暴露给调用方。

## Recommended Entry

对 Swift 集成方，最小入口是：

```swift
import PraxisRuntimeKit
```

典型初始化方式：

```swift
let client = try PraxisRuntimeClient.makeDefault()
```

高层 API 当前收敛为四个 scoped clients：

- `client.runs`
- `client.tap`
- `client.cmp`
- `client.mp`

其中最小 run 调用路径如下：

```swift
import Foundation
import PraxisRuntimeKit

let client = try PraxisRuntimeClient.makeDefault()

let run = try await client.runs.run(
  .init(
    task: "Summarize repository status",
    sessionID: .init("session.demo")
  )
)

print(run.runID.rawValue)
print(run.phaseSummary)
```

当前可直接参考的真实用法，优先看：

- [PraxisRuntimeKitTests.swift](/Users/shiyu/Documents/Project/Praxis/Tests/PraxisRuntimeKitTests/PraxisRuntimeKitTests.swift)

这个测试 target 已覆盖：

- `PraxisRuntimeClient.makeDefault(...)`
- `runs.run(...)`
- `runs.resumeRun(...)`
- `cmp.project(...).approvals.*`
- `tap.project(...).overview(...)`
- `mp.project(...).search(...)`
- `mp.project(...).resolve(...)`
- `mp.project(...).history(...)`

## Build Requirements

平台下限由 `Package.swift` 声明为：

- macOS 14+
- iOS 17+
- tvOS 17+
- watchOS 10+
- visionOS 1+

建议本地环境：

- Xcode 16 或更新版本
- Swift 6.x
- macOS 本地开发环境

说明：

- 当前 `PraxisRuntimeKit` examples 和 local baseline host adapters 主要按 macOS 验证。
- 针对非 macOS 平台，仓库已经把系统进程 / system git 相关执行面切成条件编译占位，便于后续补 Linux 实现。

查看本机 Swift 版本：

```bash
swift --version
```

## Build

Praxis 当前是纯 Swift Package，没有默认 app target。常用编译命令：

```bash
swift build
```

release 编译：

```bash
swift build -c release
```

检查 package graph：

```bash
swift package resolve
swift package describe
```

## Test

仓库主验证入口：

```bash
swift test
```

如果只想先验证公开 API 或边界守卫，可以按需执行：

```bash
swift test --filter PraxisRuntimeKitTests
swift test --filter PraxisHostRuntimeArchitectureTests
swift test --filter PraxisTapArchitectureTests
```

## Integration

在其他 SwiftPM 项目中接入时，先加入 package：

```swift
dependencies: [
  .package(url: "https://github.com/Proview-China/Praxis.git", branch: "main")
]
```

然后优先依赖 `PraxisRuntimeKit`：

```swift
dependencies: [
  .product(name: "PraxisRuntimeKit", package: "Praxis")
]
```

如果你是在做 runtime 装配、宿主桥接或导出边界，再考虑 `PraxisHostContracts`、`PraxisHostRuntime` 或 `PraxisFFI`。

## Repository Layout

主要目录：

- `Sources/`
  全部 Swift targets 的实现
- `Tests/`
  单元测试与架构守卫测试
- `Package.swift`
  package products、targets、平台与依赖关系定义
- `AGENTS.md`
  仓库协作约束
- `TAKEOVER_EXECUTION_WORKFLOW.md`
  接手执行流程文档

如果你第一次读代码，建议顺序：

1. `Package.swift`
2. `Sources/PraxisRuntimeKit/`
3. `Tests/PraxisRuntimeKitTests/`
4. `Sources/PraxisRuntimeUseCases/`
5. `Sources/PraxisRuntimeFacades/`

## Current Constraints

当前主线的几个技术边界是明确的：

- 新能力默认继续落在 Swift targets
- 不恢复旧 TypeScript / Node.js runtime
- 不把 CLI、TUI、GUI 当成长期主入口
- `PraxisRuntimeKit` 优先保持 caller-friendly，而不是暴露底层装配细节
- 架构边界变化时，应同步更新 architecture tests

## Open In Xcode

Praxis 当前没有 `.xcodeproj`，直接把仓库根目录作为 Swift Package 打开即可：

1. 打开 Xcode
2. 选择 `File` → `Open...`
3. 选择仓库根目录
4. 等待 Swift Package indexing 完成
