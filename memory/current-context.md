# Current Context

更新时间：2026-04-02

## 当前主线

- 当前项目级主线已经切换到新的 `dev` / `dev-master`。
- 当前主线提交：
  - `987effd`
  - `Import Batch 1 CMP support layer`
- 旧 `dev` 已归档为：
  - `archive/dev-legacy-2026-04-01`
  - `8d97096`

一句白话：

- 现在真正要继续推进的，不再是 legacy `dev`
- 而是 reboot 之后的新总装线

## 当前阶段一句话

Praxis 现在已经从“纯 reboot 基座”推进到：

- 以 reboot/TAP 为底座
- 已把 `CMP` 的文档、infra、支撑层安全接回新主线
- 但还没有进入高风险总装入口收口

白话：

- 新地基已经立住
- `CMP` 的低耦合主体已经装回来
- 真正最危险的 runtime 总装还没开始

## 当前已经确定的架构事实

### 1. `CMP`、`MP`、`TAP` 是并列池

- `CMP` 负责主动上下文治理
- `TAP` 负责能力供给与治理
- `MP` 仍是后续方向，不是这轮主线

当前不要做错的事：

- 不要把三者混成一个大而空的 memory system
- 不要把 `cmp/mp` 当成 “MP 已完成” 的线

### 2. `git_infra` 是共享底座

- `git_infra` 是项目级共享协作底座
- 它不是 `CMP` 私有系统
- `CMP` 只是它的消费者之一

### 3. `CMP` 的真相主干仍然是 `git`

- `CMP` 的 canonical source 是 `git`
- `CMP DB` 仍是结构化投影层，不是第二真相源
- `MQ` 仍然是邻接传播，不是无约束全局广播

### 4. reboot/TAP 基座当前仍需保护

当前 reboot 线已经在新主线上完整承接了：

- `docs/ability/20-28`
- `docs/ability/43-51`
- `src/agent_core/ta-pool*/**`
- 当前的 capability / `TAP` runtime 主线

这部分当前视为：

- 基座保护区

## 当前已经真正落到新主线的内容

### 一、reboot/TAP 基座

当前已经在新主线上成立：

- `agent_core` raw runtime kernel
- capability interface / pool
- `T/A Pool`
- `TAP` runtime completion
- three-agent real usage 主线
- `skill` / `websearch` / `MCP` 的 reboot 阶段成果

### 二、`CMP` 文档与阶段记录

当前已经接回新主线：

- `docs/ability/29-40`
- `docs/ability/44-46`
- `docs/ability/cmp-*`
- `memory/compaction-handoff-prompt*.md`
- `memory/worklog/2026-03-20-cmp-*`
- `memory/worklog/2026-03-24-cmp-*`
- `memory/worklog/2026-03-25-cmp-*`

白话：

- 现在新主线已经能读到 `CMP` 的总纲、任务包和阶段记忆
- 不用再只靠旧 `cmp/mp` 分支理解 `CMP`

### 三、`CMP` 基础设施

当前已经接回新主线：

- `infra/cmp/**`
- `scripts/cmp-status-panel-server.mjs`

这意味着：

- `CMP` 的本地 infra 面和状态面板脚本已经进入当前主线

### 四、`CMP` 支撑层代码

当前已经接回新主线：

- `src/agent_core/cmp-types/**`
- `src/agent_core/cmp-git/**`
- `src/agent_core/cmp-db/**`
- `src/agent_core/cmp-mq/**`
- `src/agent_core/cmp-runtime/**`

白话：

- `CMP` 的协议、git/DB/MQ 支撑层、runtime 支撑层已经进入新 `dev`
- 但五角色和总装入口还没接回来

## 当前还没有接回来的高风险部分

下面这些当前仍明确后置：

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/rax/index.ts`
- `package.json` 的更深总装入口调整
- `src/agent_core/cmp-five-agent/**`
- `src/agent_core/integrations/model-inference*.ts`
- `src/rax/cmp-*/**`

原因：

- 它们是 reboot/TAP 基座与 `CMP` 主体真正会撞上的装配口
- 一旦过早处理，容易把当前新主线再次打散

## 当前验证基线

以下验证已经在当前新主线上真实通过：

- `npm run typecheck`
- `npx tsx --test src/agent_core/cmp-git/*.test.ts`
  - `32 pass / 0 fail`
- `npx tsx --test src/agent_core/cmp-db/*.test.ts`
  - `23 pass / 0 fail / 1 skip`
- `npx tsx --test src/agent_core/cmp-mq/*.test.ts`
  - `25 pass / 0 fail`
- `npx tsx --test src/agent_core/cmp-runtime/*.test.ts`
  - `63 pass / 0 fail / 1 skip`

白话：

- Batch 1 接回来的 `CMP` 支撑层已经能在新主线上站住
- 这不是只把文件搬过来，还已经过了最小验证

## 当前最重要的文档入口

后续主线程和子代理应优先从下面这些入口理解现状：

- `docs/master.md`
- `docs/ability/52-dev-master-integration-outline.md`
- `docs/ability/53-dev-master-cmp-import-checklist.md`
- `docs/ability/54-dev-master-conflict-research-plan.md`
- `docs/ability/55-dev-master-batch1-task-pack.md`

## 当前最推荐下一步

当前最推荐的下一步不是直接碰 `main`，也不是直接做五角色 live 化。

而是：

1. 继续做总装入口桥位盘点
2. 决定 `package.json` 与 `rax` 表面的低风险调整
3. 在明确桥位后，再进入：
   - `cmp-five-agent`
   - `rax.cmp`
   - runtime assembly

一句收口：

- Praxis 现在已经完成了 reboot 基座 + `CMP` 支撑层的第一轮接合
- 下一步开始进入真正的高风险总装阶段
