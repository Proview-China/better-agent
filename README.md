# Praxis

Praxis 是一个基于 Swift + SwiftPM 的本地 agent runtime framework。

它的目标不是做一个命令行壳，而是提供一套可以被原生应用或其他 Swift 工程直接嵌入的运行时能力，包括：

- 任务运行与恢复
- capability 治理与审批
- 项目上下文与会话协作
- 记忆搜索、解析与历史检索
- 面向宿主的 runtime 导出边界

当前最推荐的接入入口是 `PraxisRuntimeKit`。

## 适合谁

如果你正在做这些事情，Praxis 是相关的：

- 想在 macOS 或 Apple 平台应用里嵌入本地 agent runtime
- 想直接用 Swift 调用 runtime，而不是再套一层 CLI
- 想把 run、approval、memory、project context 做成稳定的 framework API

如果你想找的是现成的桌面 UI、TUI 或部署型 Node 服务，这个仓库当前不是那个方向。

## 当前状态

Praxis 目前处于 Swift runtime 收口阶段，主工具链已经切到 Swift + SwiftPM，旧 TypeScript / Node.js runtime 不再是当前主线。

这意味着：

- 这是一个以 framework 为中心的仓库
- 主验证入口是 `swift test`
- 对外调用优先从 `PraxisRuntimeKit` 开始

## 平台与环境要求

`Package.swift` 当前声明的平台下限：

- macOS 14+
- iOS 17+
- tvOS 17+
- watchOS 10+
- visionOS 1+

建议开发环境：

- Xcode 16 或更新版本
- Swift 6.x
- macOS 本地环境

查看本机 Swift 版本：

```bash
swift --version
```

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/Proview-China/Praxis.git
cd Praxis
```

### 2. 编译

Praxis 当前是标准 Swift Package，直接在仓库根目录执行：

```bash
swift build
```

如果你想用 release 配置编译：

```bash
swift build -c release
```

如果你想先确认 package graph 正常：

```bash
swift package resolve
swift package describe
```

### 3. 测试

完整验证：

```bash
swift test
```

如果只想先验证高层公开入口：

```bash
swift test --filter PraxisRuntimeKitTests
```

## 在 SwiftPM 项目中接入

把 Praxis 作为依赖加入你的 `Package.swift`：

```swift
dependencies: [
  .package(url: "https://github.com/Proview-China/Praxis.git", branch: "main")
]
```

优先依赖 `PraxisRuntimeKit`：

```swift
dependencies: [
  .product(name: "PraxisRuntimeKit", package: "Praxis")
]
```

## 最小调用示例

下面是一条最小可运行的 Swift 调用路径：

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

如果你想从同一个 runtime 里继续走项目上下文或记忆能力，也可以使用：

- `client.cmp`
- `client.tap`
- `client.mp`

## 你今天能用到什么

当前对外最清晰的一层是 `PraxisRuntimeKit`，它把高层调用面收敛成四组入口：

- `runs`
  发起 run、恢复 run
- `tap`
  查看 capability 治理与状态概览
- `cmp`
  做项目级会话、审批、上下文读写
- `mp`
  做记忆搜索、resolve、history

如果你想看真实调用样例，最好的参考不是内部文档，而是测试：

- [PraxisRuntimeKitTests.swift](/Users/shiyu/Documents/Project/Praxis/Tests/PraxisRuntimeKitTests/PraxisRuntimeKitTests.swift)

## 仓库大致结构

你不需要先理解全部内部 target 才能开始用，但大致可以这样理解：

- `Sources/PraxisRuntimeKit/`
  面向调用者的高层 Swift API
- `Sources/` 下的 runtime/export targets：
  `PraxisRuntimeComposition`、`PraxisRuntimeUseCases`、`PraxisRuntimeFacades`、`PraxisRuntimeInterface`、`PraxisRuntimeGateway`、`PraxisFFI`
- `Sources/PraxisTap*/`
  capability 治理、review、provision、runtime support
- `Sources/PraxisCmp*/`
  项目上下文、审批、投影与交付模型
- `Sources/PraxisMp*/`
  搜索、记忆与检索模型
- `Tests/`
  单元测试与架构守卫测试

## 用 Xcode 打开

Praxis 当前没有 `.xcodeproj`，直接把仓库根目录作为 Swift Package 打开即可：

1. 打开 Xcode
2. 选择 `File` → `Open...`
3. 选择仓库根目录
4. 等待 Swift Package indexing 完成

## 当前边界

Praxis 当前强调的是原生 runtime/framework 路径，因此有几个边界是明确的：

- 新功能默认继续落在 Swift targets
- 不重新恢复旧 TS/Node runtime
- 不把 CLI、TUI、GUI 当成长期主入口
- 对外调用优先走 `PraxisRuntimeKit`

## 许可证

本仓库使用 [LICENSE](/Users/shiyu/Documents/Project/Praxis/LICENSE) 中定义的许可证。
