## 新增需求

### 需求:core 必须暴露 Linux 沙盒能力快照
在 Linux 环境下，core 必须提供统一的 capability probe 结果，至少覆盖 `setrlimit`、Landlock、network namespace、cgroup v2、seccomp` 等能力。能力快照必须可被 UI 直接消费，禁止让 UI 通过猜测内核版本或执行器行为来推断能力是否存在。

#### 场景:Linux 环境请求 capability probe
- **当** UI 或上层调用方请求 Linux sandbox capability probe
- **那么** core 必须返回结构化能力快照
- **那么** 每项能力必须明确标识为 `available`、`unavailable` 或 `unsupported`

### 需求:不支持能力必须显式回退
当某项 Linux 原生沙盒能力当前不可用时，core 必须在执行结果与 capability probe 中明确返回不支持状态，禁止静默降级成“看起来被隔离，实际没有隔离”的假象。

#### 场景:Landlock 不可用
- **当** 当前 Linux 内核或运行环境不支持 Landlock
- **那么** capability probe 必须明确标识 Landlock 不可用
- **那么** 依赖 Landlock 的执行结果必须显式说明文件系统隔离未启用

## 修改需求
无

## 移除需求
无
