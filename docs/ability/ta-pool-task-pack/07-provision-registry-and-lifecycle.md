# WP07: Provision Registry And Lifecycle

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

给 provisioning 产物建立 registry 和生命周期管理。

## 你的任务

1. 为 provision 结果建立 registry。
2. 管理状态：
   - pending
   - building
   - verifying
   - ready
   - failed
   - superseded
3. 支持去重、替换、版本化和查询。

## 建议修改文件

- `src/agent_core/ta-pool-provision/**`

## 边界约束

- 不直接执行 provision build。
- 不接 reviewer runtime。

## 必须包含的测试

- 去重测试
- superseded 替换测试
- ready 后可查询 artifact bundle 测试
