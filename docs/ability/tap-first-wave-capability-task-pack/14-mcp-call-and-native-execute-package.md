# 14 MCP Call And Native Execute Package

## 任务目标

在 truthfulness 修正完成后，再把 `mcp.call` 与 `mcp.native.execute` 作为更厚的 family 成员整理进 `TAP`。

## 必须完成

- 为 `mcp.call` 定义 package
- 为 `mcp.native.execute` 定义 package
- 在 package / policy / usage 中明确：
  - `mcp.call` 有副作用风险
  - `mcp.native.execute` 是长运行、更高治理成本的能力
- 在 `rax-mcp-adapter` 测试中补：
  - unsupported native route 负向测试
  - happy path 与失败 path

## 允许修改范围

- `src/agent_core/integrations/rax-mcp-adapter.ts`
- `src/agent_core/integrations/rax-mcp-adapter.test.ts`
- `src/agent_core/capability-package/**`
- `src/agent_core/runtime.test.ts`

## 不要做

- 不要在这里放开 `mcp.configure`
- 不要把 unsupported route 静默吞掉

## 验收标准

- `mcp.call` 与 `mcp.native.execute` 的风险与 policy 明显高于 read family
- TAP 面向 unsupported native route 的行为明确

## 交付说明

- 说明当前是否采用：
  - 显式失败
  - 或 `variant=auto` 时回退 shared-runtime
