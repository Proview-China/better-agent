# WP12: Runtime Assembly And Integration

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

在前面各工作包完成后，负责把新的统一能力接口和能力池装回 `agent_core`，做集成与联调。

你是最后的装配负责人。

## 项目背景

- 前面各包已经分别实现：
  - protocol freeze
  - kernel gateway
  - manifest/binding
  - invocation/lease
  - pool registry/lifecycle
  - dispatch scheduler
  - result/event bridge
  - model inference adapter
  - rax websearch adapter
  - rax mcp adapter skeleton
  - rax skill adapter skeleton
  - hot-swap/drain/health

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `memory/current-context.md`
- 前面所有 WP 的最终代码与测试

## 你的任务

1. 把 `AgentCoreRuntime` 切到新的 `KernelCapabilityGateway` / `CapabilityPool` 装配模式。
2. 尽量减少旧 `CapabilityPortBroker` 特判路径。
3. 让当前最小闭环至少继续成立：
   - session
   - run
   - goal
   - model inference
   - completed
4. 若可能，保住现有 `search.ground` 桥接。
5. 统一测试与类型检查。

## 建议修改文件

- `src/agent_core/runtime.ts`
- `src/agent_core/index.ts`
- 以及前面各 WP 的整合入口文件

## 边界约束

- 不在这里重新设计协议
- 不在这里扩新功能面
- 不要顺手大改 `src/rax/**`

## 必须考虑的性能点

- 最小闭环不能因为新分层而明显拉长热路径
- 避免重复 journal append
- 避免 gateway/pool/adapter 三层产生多余对象搬运

## 验证要求

- `npm run typecheck`
- `npm test`
- `npx tsx --test src/agent_core/**/*.test.ts`
- 若已有最小直问直答 smoke，可再次验证

## 最终汇报格式

1. 你集成了哪些模块
2. runtime 总装路径现在是什么
3. 旧 broker/特判路径还剩哪些
4. 当前最小闭环是否仍成立
5. 你认为下一步最该补的是哪一条能力接线
