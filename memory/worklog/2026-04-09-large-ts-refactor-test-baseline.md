# 2026-04-09: 巨型 TS 文件拆分前测试基线落地

## 做了什么

- 新增 `scripts/refactor-test-gates.mjs`，把大文件拆分前的测试门槛固化成可执行 gate。
- 在 `package.json` 里接入：
  - `npm run test:refactor:list`
  - `npm run test:refactor:show -- <gate>`
  - `npm run test:refactor:gate -- <gate>`
- 把“巨型 TS 文件拆分前必须冻结测试基线”写成 ADR：
  - `memory/decisions/ADR-0001-large-ts-refactor-test-gates.md`

## 为什么现在做

- 当前已经明确识别出一批巨型 TS 文件。
- 后续拆分如果没有统一 gate，容易出现“命令记错、少跑 focused suites、回归原因不清”的情况。
- 先把基线工具落下来，后面拆分才能稳步推进。

## 当前冻结的仓库级基线

本次落地前后，已实际回放并确认：

- `npm run typecheck`
- `npm run build`
- `npm test`

结果：

- `typecheck`：通过
- `build`：通过
- `test`：250 项中 248 通过、0 失败、2 跳过

## 当前 gate 覆盖

- `baseline`
- `live-agent-chat`
- `tap-tooling-adapter`
- `capability-package`
- `runtime`
- `rax-facades`
- `workspace-network`

其中：

- `live-agent-chat` 已补上 `shared.test.ts` 作为第一批 focused suite
- `runtime`、`tap-tooling-adapter`、`capability-package`、`rax-facades`、`workspace-network` 都已经把 focused tests 录进 gate

## 这次落地里顺手发现并修掉的问题

- 仅靠 `npm test` 还不足以覆盖这批拆分前高风险路径；`workspace-read-adapter` 这类更深层的 focused suites 需要显式纳入 gate，才能真正冻结回归边界。
- `workspace-read-adapter` 原先在 macOS 临时目录下会踩到 `/var` 和 `/private/var` 的真实路径差异：
  - `glob` / `grep` / `read_many` 这类目录扫描路径会因为工作区真实路径不一致漏掉命中
  - TypeScript language service 的 `workspace_symbol` / `definition` / `references` 会因为相对路径基准不一致，把本来命中的结果误过滤成“超出工作区”
- 已修复方式：
  - 目录扫描统一按 `realpath(workspaceRoot)` 计算相对路径
  - TypeScript workspace context 统一使用规范化后的真实工作区路径，避免 `/var` 与 `/private/var` 混用

## 额外验证

- `npm run test:refactor:list`
- `npm run test:refactor:show -- runtime`
- `npm run test:refactor:gate -- live-agent-chat`
- `npm run test:refactor:gate -- workspace-network`

当前 `workspace-network` gate 已通过。

## live-agent-chat 第一轮拆分

- 先把共享类型、常量、日志器和纯工具函数抽到 `src/agent_core/live-agent-chat/shared.ts`
- 把 CLI 展示层和 direct composer 交互抽到 `src/agent_core/live-agent-chat/ui.ts`
- 入口 `src/agent_core/live-agent-chat.ts` 现在主要保留：
  - model inference
  - core planner / capability bridge
  - CMP sidecar turn
  - runtime 创建
  - main loop
- 新增 `src/agent_core/live-agent-chat/shared.test.ts`，先锁住：
  - CLI 参数解析
  - core action envelope 解析
  - TAP shell request 解析

## 下一步

- 后续开始拆分某个大文件前，先执行：
  - `npm run test:refactor:show -- <gate>`
  - `npm run test:refactor:gate -- <gate>`
- 第一轮拆分只做内部重组，不改公开导出路径、函数名、helper ref 字符串。
- 如果后续新增新的大文件拆分对象，同步把 gate 补进 `scripts/refactor-test-gates.mjs`。
