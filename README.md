# Praxis

Praxis 是一个基于 Swift + SwiftPM 构建的本地 runtime/framework 仓库，目标是把 agent runtime、能力编排、审批治理、记忆检索和导出边界收敛成一套可嵌入、可测试、可导出的原生运行时。

当前仓库的重点不是 CLI、TUI 或 GUI 壳，而是稳定的 framework 公开面。对 Swift 调用方来说，最推荐的入口是 `PraxisRuntimeKit`；更底层的 host contracts、runtime composition、gateway 与 FFI 主要面向运行时装配和导出边界。

## 项目定位

- 主工具链：Swift 6 + SwiftPM
- 主形态：可嵌入 runtime / framework
- 默认验证命令：`swift test`
- 推荐公开入口：`PraxisRuntimeKit`
- 当前方向：继续收口 Swift 原生 runtime，不恢复旧 TypeScript / Node.js runtime

Praxis 当前主要包含这些层次：

- `PraxisFoundation`
  纯领域模型、状态、运行阶段、checkpoint、journal 等基础语义。
- `PraxisCapabilityDomain`
  capability contract、planning、result normalization、catalog。
- `PraxisTapDomain`
  capability governance、review、provision、runtime availability。
- `PraxisCmpDomain`
  项目上下文、审批、投影、交付、Git/DB/MQ 相关模型。
- `PraxisMpDomain`
  搜索、记忆、检索与多代理记忆相关能力。
- `PraxisHostContracts`
  provider、workspace、tooling、infra、user I/O 宿主协议。
- `PraxisHostRuntime`
  runtime composition、use case、facade、interface、gateway、FFI。
- `PraxisRuntimeKit`
  面向调用者的高层 Swift API，收敛为 `runs` / `tap` / `cmp` / `mp` 四个入口。

## 环境要求

`Package.swift` 当前声明的平台下限如下：

- macOS 14+
- iOS 17+
- tvOS 17+
- watchOS 10+
- visionOS 1+

本地开发建议环境：

- Xcode 16 或更新版本
- Apple Swift 6.x
- macOS 本地开发环境

当前机器上的 Swift 版本示例：

```bash
swift --version
```

## 如何编译

Praxis 当前是 Swift Package，没有默认的可执行 app target。最直接的编译方式就是在仓库根目录执行：

```bash
swift build
```

如果你想用 release 配置编译：

```bash
swift build -c release
```

如果你希望先解析依赖并确认包图正常：

```bash
swift package resolve
swift package dump-package
```

## 如何测试

仓库的主验证入口是：

```bash
swift test
```

如果只想先验证某个测试 target，可以按需执行：

```bash
swift test --filter PraxisRuntimeKitTests
swift test --filter PraxisHostRuntimeArchitectureTests
```

推荐的本地验证顺序：

1. `swift build`
2. `swift test`
3. 如有公开面或边界改动，再重点回看相关 architecture tests

## 如何在 Xcode 中打开

Praxis 当前没有 `.xcodeproj`，直接把 Swift Package 作为 package 打开即可：

1. 打开 Xcode
2. 选择 `File` → `Open...`
3. 选择本仓库根目录
4. 等待 Swift Package indexing 完成

如果你只是想浏览 products 和 targets，也可以执行：

```bash
swift package describe
```

## 推荐从哪里开始看

如果你是第一次接触这个仓库，建议按这个顺序读：

1. `README.md`
2. `Package.swift`
3. `Sources/PraxisRuntimeKit/`
4. `Tests/PraxisRuntimeKitTests/`
5. `TAKEOVER_EXECUTION_WORKFLOW.md`

其中 [PraxisRuntimeKitTests.swift](/Users/shiyu/Documents/Project/Praxis/Tests/PraxisRuntimeKitTests/PraxisRuntimeKitTests.swift) 已经覆盖了当前最值得参考的几条调用路径：

- `PraxisRuntimeClient.makeDefault(...)`
- `runs.run(...)` / `runs.resumeRun(...)`
- `cmp.project(...).approvals.*`
- `mp.project(...).search(...)` / `resolve(...)` / `history(...)`

## 在其他 SwiftPM 项目中接入

如果你要把 Praxis 作为依赖接入另一个 Swift Package，可以先按下面的方向使用：

```swift
dependencies: [
  .package(url: "https://github.com/Proview-China/Praxis.git", branch: "main")
]
```

在目标里优先依赖 `PraxisRuntimeKit`：

```swift
dependencies: [
  .product(name: "PraxisRuntimeKit", package: "Praxis")
]
```

对于大多数调用方，建议先从 `PraxisRuntimeKit` 开始，而不是直接依赖 `PraxisRuntimeComposition`、`PraxisRuntimeGateway` 或 `PraxisFFI`。

## 当前编译与维护约束

- 新功能默认落在 Swift targets，不恢复旧 TS/Node runtime。
- `PraxisRuntimeKit` 应保持 caller-friendly，但不泄漏底层 composition / transport / FFI 细节。
- Core 领域层不应直接依赖宿主副作用实现。
- 架构边界变化时，应同步更新对应测试，而不是只改实现。

## 相关文档

- [TAKEOVER_EXECUTION_WORKFLOW.md](/Users/shiyu/Documents/Project/Praxis/TAKEOVER_EXECUTION_WORKFLOW.md)
- [AGENTS.md](/Users/shiyu/Documents/Project/Praxis/AGENTS.md)

当前仓库里引用了 `SWIFT_REFACTOR_PLAN.md` 作为 canonical 计划入口，但该文件目前不在工作树中；在它恢复前，执行层面的推进可先参考 `TAKEOVER_EXECUTION_WORKFLOW.md`。
