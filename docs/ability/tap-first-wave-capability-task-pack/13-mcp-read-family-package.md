# 13 MCP Read Family Package

## 任务目标

先把 `mcp.listTools` 和 `mcp.readResource` 这类偏只读探测能力整理成 `TAP` 第一波 capability family。

## 必须完成

- 为 `mcp.listTools` 定义 package
- 为 `mcp.readResource` 定义 package
- 明确它们在 policy 上属于：
  - 可审查
  - 可只读探测
  - 不等于执行外部工具
- 补 `rax-mcp-adapter` 对应 family 测试
- 补 `runtime.test.ts` 级别 TAP 接线测试

## 允许修改范围

- `src/agent_core/integrations/rax-mcp-adapter.ts`
- `src/agent_core/integrations/rax-mcp-adapter.test.ts`
- `src/agent_core/capability-package/**`
- `src/agent_core/runtime.test.ts`

## 不要做

- 不要把 `mcp.call` 和这两项混成一个无差别低风险能力
- 不要在这里扩 hosted/native execute

## 验收标准

- `mcp.listTools` / `mcp.readResource` 能作为 family 级 capability 被 TAP 消费
- policy 明确它们比 `mcp.call` 更适合先放开

## 交付说明

- 明确 family 共享和 action-specific 差异
