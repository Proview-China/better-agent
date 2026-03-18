# WP13: End-To-End Smoke And Test Pack

你现在在仓库 `/home/proview/Desktop/Praxis_series/Praxis` 工作。

## 当前唯一目标

为 `T/A Pool` 第一版补齐测试、fixtures 和最小 smoke。

## 你的任务

1. 设计最小 e2e fixtures：
   - baseline read/write
   - requestable MCP-like capability
   - missing capability -> provisioning
   - dangerous action -> interrupt
2. 整理测试入口和 smoke 脚本。
3. 验证 control plane 不污染 execution plane 热路径。

## 建议修改文件

- `src/agent_core/**/*.test.ts`
- 如有必要新增 `scripts/` 下最小 smoke

## 边界约束

- 不在这里扩新功能。
- 只做验证、证据和补缝。

## 必须包含的验证

- `npm run typecheck`
- `npx tsx --test src/agent_core/**/*.test.ts`
- `npm test`

## 最终汇报格式

1. 覆盖了哪些核心流程
2. 哪条路径最脆弱
3. 还缺什么真实能力接线
