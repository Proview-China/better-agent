# WP7: Model Inference Adapter

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把当前 runtime 特判的 `model_inference` 收回统一能力接口，做成标准 `CapabilityAdapter`。

## 项目背景

- 当前 `model_inference` 还是 `AgentCoreRuntime` 里的专门分支
- 这不利于统一能力面和后续多池复用
- 当前最小闭环已验证可跑 `gmn + gpt-5.4`

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/runtime.ts`
- `src/agent_core/integrations/model-inference.ts`
- `src/agent_core/capability-types/**`
- `src/agent_core/capability-pool/**`

## 你的任务

1. 抽出 `model inference adapter`。
2. 让它实现统一的 `CapabilityAdapter` 语义。
3. 设计一个可挂到 pool 的 `capabilityKey`，例如：
   - `model.infer`
   - 或保持与 kernel intent 对齐但通过 adapter lower
4. 保留当前最小直问直答闭环能力。

## 建议新增/修改文件

- `src/agent_core/integrations/model-inference-adapter.ts`
- 必要时调整 `src/agent_core/integrations/model-inference.ts`
- `src/agent_core/integrations/model-inference-adapter.test.ts`
- 必要时调整 `src/agent_core/runtime.ts`

## 边界约束

- 不要扩 provider matrix
- 不要在这里实现新的 pool registry
- 不要顺手改 `rax` 内部

## 必须考虑的性能点

- 模型推理是核心热路径之一
- prepare 和 execute 之间要支持短路径
- 结果统一回到 envelope，不保留 runtime 特判

## 验证要求

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
- 覆盖：
  - 现有最小模型调用仍然通过
  - 结果能通过统一 result bridge 回推 run

## 最终汇报格式

1. 你实现了哪些文件
2. `model_inference` 是怎么回到统一能力面的
3. 旧 runtime 特判被削减到什么程度
4. 当前仍保留了哪些 provider 现实限制
5. 联调时最需要注意的事件点是什么
