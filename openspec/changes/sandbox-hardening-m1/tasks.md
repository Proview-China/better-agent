## 1. 能力探测

- [x] 1.1 设计 Linux sandbox capability probe 的 JSON 合约，并落实到 core 接口与内部状态中
- [x] 1.2 实现 `setrlimit`、Landlock、network namespace、cgroup v2、seccomp 的探测与统一结果输出

## 2. Linux 原生隔离

- [x] 2.1 为 `shell` 与 `code` 执行器实现 Linux 文件系统隔离主路线，优先接入 Landlock
- [x] 2.2 为 `shell` 与 `code` 执行器实现 Linux 真实禁网主路线，优先接入 network namespace

## 3. 资源限制与审计

- [x] 3.1 补齐 Linux baseline 资源限制的生效/未生效回显，并把结果写入统一审计面
- [x] 3.2 明确不支持能力的回退语义，避免出现“看起来已隔离，实际未隔离”的假成功结果

## 4. 验证

- [x] 4.1 为 capability probe、Landlock/netns 成功路径与不支持回退路径补单元测试
- [x] 4.2 为 binding 层透传与 Linux 沙盒能力快照补 smoke test 或等价验证
