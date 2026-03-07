## 为什么

`sandbox-hardening-m0` 已经把 `shell` 与 `code` 执行器提升到了“可控、可审计、可中断”的阶段，但 Linux 侧仍然主要依赖逻辑层的策略与 POSIX 资源限制，尚未形成真正的系统级文件系统隔离与网络隔离。同时，项目已经明确希望尽量减少额外配置和非系统依赖，因此下一阶段需要优先使用 Linux 原生能力，而不是引入外部 sandbox 工具链。

现在推进这项变更，是为了在 Linux 上把沙盒从“内核级策略控制”推进到“系统原生隔离 + 能力探测 + 显式回退”的阶段，并继续保持 core 作为唯一安全决策主体，UI 层只消费 core 暴露的结果与能力快照。

## 变更内容

- 为 Linux 增加 sandbox capability probe，探测 `setrlimit`、Landlock、network namespace、cgroup v2、seccomp 等能力，并通过 core API 暴露统一快照。
- 为 Linux `shell` / `code` 执行器引入系统原生文件系统隔离主路线，优先使用 Landlock 实现最小依赖的读写路径限制。
- 为 Linux `shell` / `code` 执行器引入系统原生禁网主路线，优先通过 network namespace 形成真实的 `network_access=false` 语义。
- 补齐 Linux baseline 资源限制的生效与回显，至少明确区分“已启用 / 未启用 / 不支持”。
- 扩展单元测试与 smoke test，覆盖 capability probe、隔离成功路径与不支持回退路径。

## 功能 (Capabilities)

### 新增功能
- `linux-sandbox-capability-probe`: 提供 Linux 原生沙盒能力探测与统一能力快照。
- `linux-sandbox-filesystem-isolation`: 在 Linux 上提供基于系统原生能力的文件系统访问限制。
- `linux-sandbox-network-isolation`: 在 Linux 上提供真实禁网语义与结构化回退。
- `linux-sandbox-resource-enforcement`: 在 Linux 上补齐 baseline 资源限制的生效与审计。

### 修改功能
- 无

## 影响

- 受影响代码主要位于 `better-agent/core/header/agent_core.h`、`better-agent/core/cpp/internal/`、`better-agent/core/cpp/agent_core.cpp`、`better-agent/core/bindings/node/` 与 `better-agent/core/tests/`。
- 本轮主攻 Linux，继续保持 macOS 路径可用，但不要求把 Linux 新增隔离能力完全复制到 macOS。
- 本轮明确避免引入新的外部 sandbox 工具依赖，优先使用 Linux 系统原生能力。
