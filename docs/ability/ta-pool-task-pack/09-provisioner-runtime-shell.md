# WP09: Provisioner Runtime Shell

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

做一个最小 provisioner runtime 壳，让“没有就去造”的流程能跑通。

## 你的任务

1. 设计 provisioner runtime shell：
   - 接收 provision request
   - 执行伪 build / mock build
   - 产出 artifact bundle
   - 注册回 provision registry
2. 保留未来真实 builder hook。

## 建议修改文件

- `src/agent_core/ta-pool-provision/**`
- `src/agent_core/ta-pool-runtime/**`

## 边界约束

- 第一版允许使用 mock builder。
- 不要直接在这里接真实系统安装逻辑。

## 必须包含的测试

- provision request -> ready bundle 测试
- failed build 测试
- reviewer 可重新读取 ready 结果测试
