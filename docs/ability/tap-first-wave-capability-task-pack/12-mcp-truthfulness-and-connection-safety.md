# 12 MCP Truthfulness And Connection Safety

## 任务目标

先把 `mcp` 族的 support matrix 和连接安全收口对，再做 `TAP` 家族接入。

## 必须完成

- 吸收 MCP 线最有价值的收口点：
  - OpenAI agent-hosted native support matrix 收真
  - duplicate connection 的“先连后换，失败保旧连接”
  - 更细的 launch / connect error 分类
- 在 `mcp-runtime.test.ts` 锁住：
  - `openai + agent + streamable-http` 不再被误判为可执行 native route
- 明确：
  - 不可用的是哪一小块
  - 仍然可用的是哪一小块

## 允许修改范围

- `src/integrations/openai/agent/mcp.ts`
- `src/rax/mcp-runtime.ts`
- `src/rax/mcp-runtime.test.ts`
- 必要时少量 `src/rax/facade.ts`

## 不要做

- 不要把整个 MCP 族都判成不可用
- 不要整条 cherry-pick 旧分支

## 验收标准

- support matrix truthfulness 更强
- duplicate connection 替换安全被测试锁住
- 错误分类更可解释

## 交付说明

- 明确哪些逻辑来自 `origin/issue-3-mcp-review-fixes`
