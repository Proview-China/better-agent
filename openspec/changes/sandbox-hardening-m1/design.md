## 上下文

`sandbox-hardening-m0` 已完成统一 policy、超时、中断、输出裁剪、网络 gate 与审计回显，但 Linux 侧仍主要停留在逻辑层控制与 POSIX baseline。为了进一步提升真实性，需要在 Linux 上把“是否真的被隔离”交给系统原生能力，而不是交给 UI 或上层策略猜测。

同时，项目明确要求尽量减少配置难度和非系统依赖，因此本轮不采用 `bubblewrap` 等外部工具作为主路线，而是优先使用 Linux 内核原生能力：Landlock、network namespace、setrlimit、cgroup v2、seccomp 的能力探测与渐进式接入。

## 目标 / 非目标

**目标：**
- 在 Linux 上增加统一 capability probe
- 用系统原生能力补齐文件系统隔离与真实禁网的主路线
- 明确区分资源限制的“已生效 / 未生效 / 不支持”
- 继续保持 core 作为安全决策主体，UI 只消费结果

**非目标：**
- 不引入外部 sandbox 二进制依赖作为主方案
- 不在本轮实现完整 seccomp profile
- 不要求 macOS 完整复制 Linux 的隔离方案
- 不在本轮实现容器级 rootfs 隔离或完整虚拟化

## 决策

### 1. capability probe 先于执行增强

在 Linux 上先探测环境能力，再决定具体执行路径。这样可以避免执行时临时试错，并能把真实能力快照暴露给 UI 与测试系统。

### 2. 文件系统隔离优先用 Landlock

相较于自建 mount namespace / rootfs 路径，Landlock 更适合作为“少依赖、少配置”的 Linux 文件系统隔离主路线。它可以在不引入外部工具的情况下，先把读写路径约束落到内核层。

### 3. 禁网优先用 network namespace

`network_access=false` 在 Linux 上应尽量形成真实禁网。network namespace 是当前最符合“系统原生能力优先”路线的方案；若当前环境不可用，必须显式回退。

### 4. baseline 限制继续复用 setrlimit

对 CPU、内存、文件大小、进程数等基础限制，继续把 `setrlimit` 作为 baseline 主路线；将 cgroup v2 留作能力增强项，由 probe 决定是否启用。

### 5. 不做“假成功”

无论是文件系统隔离、禁网还是资源限制，只要当前能力未实际生效，都必须在执行结果里明确标记为 `unsupported` 或 `not_enabled`，而不是仅在内部日志里悄悄忽略。

## 风险 / 权衡

- Landlock 与 network namespace 的可用性受内核与环境影响，因此 probe 与显式回退会成为本轮设计重点。
- 不引入外部工具能降低配置难度，但也意味着需要自己维护能力探测与回退路径。
- 若 seccomp / cgroup v2 暂时只做到探测而未完整启用，这也是可接受的，只要 contract 足够清晰。
