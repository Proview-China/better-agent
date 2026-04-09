# ADR-0001: 巨型 TS 文件拆分前必须冻结测试基线

## 状态

已接受

## 背景

Praxis 当前已经进入可继续开发的总装主线，但仓库里仍然存在一批单文件体量很大的 TypeScript 文件。

这些文件后续需要逐步拆分，但如果拆分前没有把行为基线和 focused regression suites 固定下来，后面一旦回归失败，就很难判断到底是：

- 内部结构重组带来的真实行为变化
- 导出路径或 helper ref 漂移
- 还是单纯漏跑了关键回归测试

我们需要一套仓库内可执行、可回读、可复用的拆分前测试门槛，而不是依赖聊天记录或临时命令。

## 决策

我们接受下面这套巨型 TS 文件拆分前测试门槛：

- 所有大文件拆分前后，必须先跑仓库级冻结基线：
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- 每个拆分对象在仓库级基线之外，还必须补跑自己对应的 focused regression suites。
- 第一轮拆分默认只做内部重组，不改公开导出路径、函数名、helper ref 字符串。
- 这些门槛由仓库脚本 `scripts/refactor-test-gates.mjs` 和 `package.json` 中的 `test:refactor:*` 命令统一承载。

当前 gate 分组包括：

- `baseline`
- `live-agent-chat`
- `tap-tooling-adapter`
- `capability-package`
- `runtime`
- `rax-facades`
- `workspace-network`

其中 `live-agent-chat` 在第一轮拆分后已经补上 `shared.test.ts`，当前 gate 不再是 baseline only。

## 原因

- 先冻结基线，能把“结构变化”和“行为变化”分开。
- 用脚本固化 gate，比把命令写在临时文档或评论里更不容易漂移。
- 统一 gate 名称后，后续拆分可以直接说“先跑 runtime gate”，协作成本更低。
- 第一轮保持旧出口不变，能显著缩小回归半径，让测试失败更容易定位。

## 后果

- 后续任何巨型 TS 文件拆分，都默认先跑一次对应 gate，再开始动手。
- 每轮拆分完成后，需要先回放对应 focused suites，再回放仓库级基线。
- 这会增加一些重复测试时间，但换来的是更稳定的回归判断和更低的误伤概率。
- 后续如果新增新的巨型文件拆分对象，必须同步更新 `scripts/refactor-test-gates.mjs`，让 gate 继续保持为单一事实来源。
