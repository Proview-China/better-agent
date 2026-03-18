# WP8: Rax Websearch Adapter

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

把现有 `search.ground` bridge 升级为标准 `CapabilityAdapter`，接入新的能力池接口。

## 项目背景

- 当前 `agent_core` 已经有 `search.ground` 的第一条 bridge
- 但它还暴露了较多 provider/model/layer 细节
- 新阶段要求把这些细节压到 provider-facing 层

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/agent_core/integrations/rax-port.ts`
- `src/rax/facade.ts`
- `src/rax/websearch-types.ts`
- `src/agent_core/capability-types/**`

## 你的任务

1. 把现有 `search.ground` bridge 迁移为标准 adapter。
2. 让 kernel-facing plan 不再直接裸露 provider-specific 细节。
3. 统一输出到 `CapabilityResultEnvelope`。
4. 保持当前已有 `search.ground` 跑通能力。

## 建议新增/修改文件

- `src/agent_core/integrations/rax-websearch-adapter.ts`
- 必要时收缩 `src/agent_core/integrations/rax-port.ts`
- `src/agent_core/integrations/rax-websearch-adapter.test.ts`

## 边界约束

- 不改 `src/rax/websearch-runtime.ts` 内部语义
- 不扩新的 search 功能
- 不把 `search.web` / `search.fetch` 一起硬做完

## 必须考虑的性能点

- prepared plan 应可缓存
- 大证据结果尽量走 envelope/artifact
- adapter 不能把 provider route 细节重新漏回 kernel-facing 层

## 验证要求

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
- 覆盖：
  - `search.ground` 通过 adapter 正常执行
  - 输出映射正确
  - error/blocked/timeout 能进入统一 envelope

## 最终汇报格式

1. 你实现了哪些文件
2. 旧 bridge 与新 adapter 的关系是什么
3. 哪些 provider 细节被成功下沉了
4. 结果壳里保留了哪些 search evidence
5. 后续 `search.web/fetch` 若接入，应复用哪部分
