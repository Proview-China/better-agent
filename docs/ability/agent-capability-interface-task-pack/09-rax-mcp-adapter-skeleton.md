# WP9: Rax MCP Adapter Skeleton

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

为 `mcp` 能力建立 `CapabilityAdapter` 骨架，但本轮先做到接口可接入，不强行把所有 MCP 能力一次做完。

## 项目背景

- 当前 `rax.mcp` 已有 shared/native 双分层
- `mcp` 的形态比 `websearch` 更厚，涉及连接、会话、carrier、serve 等生命周期
- 本轮的重点是接口化，不是吃完整个 MCP 路线图

## 你必须先阅读

- `docs/ability/17-agent-capability-interface-and-pool-outline.md`
- `src/rax/facade.ts`
- `src/rax/mcp-types.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-native-runtime.ts`

## 你的任务

1. 建立 `mcp` adapter 的最小骨架。
2. 至少明确：
   - 哪些 `mcp.*` 动作适合进入统一能力面第一版
   - 哪些先保持 prepare/build/compose 形态
3. 给 pool-facing 层一个干净的接入点。
4. 为以后接：
   - `mcp.call`
   - `mcp.listTools`
   - `mcp.readResource`
   - `mcp.native.execute`
   留下结构。

## 建议新增文件

- `src/agent_core/integrations/rax-mcp-adapter.ts`
- `src/agent_core/integrations/rax-mcp-adapter.test.ts`

## 边界约束

- 不要试图一次收完全部 MCP 能力
- 不要重写 `rax.mcp` runtime
- 不要把 provider shell / official carrier 细节漏进 kernel-facing 层

## 必须考虑的性能点

- 区分短调用与长生命周期连接
- 不要让 kernel-facing 层直接持有 MCP client/session 句柄
- 长连接状态应放在 provider/pool 侧

## 验证要求

- `npm run typecheck`
- 以 skeleton contract test 为主
- 至少验证：
  - `supports`
  - `prepare`
  - 最小 `execute` / `unsupported` 路径

## 最终汇报格式

1. 你实现了哪些文件
2. 第一版 `mcp` adapter 收哪些动作，不收哪些动作
3. 长连接生命周期被放在哪一层
4. 哪些 provider/carrying 细节被成功隔离
5. 后续真正扩 `mcp` 时的第一优先级是什么
