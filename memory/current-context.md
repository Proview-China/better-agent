# Current Context

更新时间：2026-04-05

## 当前主线与总装状态

- 当前项目级主线仍以新的 `dev` / `dev-master` 为准。
- 当前正在做的不是继续分叉开发，而是把 `cmp/mp` 这条高风险实现线并回 `dev-master`，收成新的总装继续线。
- 当前专门用于这次整合的 worktree / 分支是：
  - worktree: `.parallel-worktrees/integrate-dev-master-cmp`
  - branch: `integrate/dev-master-cmp`

一句白话：

- `dev-master` 代表 reboot/TAP 基座接回后的新主线
- `cmp/mp` 代表更深入的 `CMP` runtime / `rax.cmp` / 五角色实现线
- 现在进入的是“把两边真东西收成一条线”的阶段

## 当前阶段一句话

Praxis 现在已经不再停留在：

- 只有 reboot/TAP 基座
- 或只有 `CMP` 的文档 / 支撑层 / low-risk surface

而是正在进入：

- `dev-master` 的新主线基座
- 加上 `cmp/mp` 的 `CMP` 高风险 runtime 与五角色实现
- 做第一次真正的总装合并

白话：

- `CMP` 和 `TAP` 现在都不是“还没开始”的模块
- 真正困难的地方已经变成“怎么把两边都保住并装在一起”

## 当前已经确定的架构事实

### 1. `dev-master` 是新的项目主线底座

- 它承接了 reboot/TAP 基座
- 承接了 `CMP` 的文档、infra、支撑层代码
- 承接了 `rax` 的 Phase A / low-risk surface

当前不要做错的事：

- 不要再把旧 `dev` 当作主要继续线
- 不要把 `dev-master` 误当成“只是文档分支”

### 2. `cmp/mp` 是 `CMP` 高风险实现线

当前 `cmp/mp` 已经不只是：

- `CMP` 的协议
- `CMP` 的 DB / MQ / git 支撑层

而是已经把下面这些推进到了主链接缝：

- `src/agent_core/runtime.ts` 的 `CMP` workflow 接口
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`
- `src/agent_core/cmp-five-agent/**`

白话：

- `cmp/mp` 带回来的是真正会和新主线正面相撞的 runtime 总装

### 3. reboot/TAP 基座仍然是保护区

当前必须继续保住：

- `src/agent_core/ta-pool*/**`
- 第一波 capability package / baseline 相关成果
- `rax` 当前已经接回的新导出面和 status panel / config / connectors

不要做错的事：

- 不要为了吃进 `cmp/mp`，把 `dev-master` 上后续接回来的 TAP / rax surface 又冲掉

## 当前整合分支已经读到的合并事实

`dev-master <- cmp/mp` 的第一次 merge 试算已经证明：

- 大量文件可以自动合并
- 这不是全仓库爆炸型冲突
- 冲突主要集中在总装入口与项目锚点

当前第一次试算的主要冲突口是：

- `memory/current-context.md`
- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/index.ts`
- `src/rax/cmp-types.ts`
- `src/rax/index.ts`

白话：

- 真正冲突的是“谁来定义当前主线的事实”和“谁来定义 runtime / rax 的正式总装入口”

## 当前已经确认应当保留的两侧价值

### 一、`dev-master` 侧必须保留的东西

- 新 `dev` / `dev-master` 作为项目主线的事实锚点
- reboot/TAP 基座与第一波 capability package 成果
- `CMP` 支撑层与 low-risk `rax` surface 的回接成果
- 后续继续围绕新主线推进的文档入口与 handoff 体系

### 二、`cmp/mp` 侧必须保留的东西

- `CMP` workflow 真正接进 `AgentCoreRuntime`
- `rax.cmp` 的 facade / runtime 正式入口
- 五角色 runtime、tap bridge、observability 等真正实现
- `CMP` 的 readback / recover / dispatch / requestHistory 这套更完整的控制面

## 当前最真实的整合判断

现在最合理的方向不是：

- 保守地把 `cmp/mp` 再后置
- 也不是只保 `cmp/mp` 而回退 `dev-master`

而是：

1. 以 `dev-master` 作为项目主线身份
2. 以 `cmp/mp` 作为 `CMP` runtime / five-agent 实现主体
3. 在 `src/agent_core/runtime.ts` 与 `src/rax/index.ts` 这类总装入口做人工 union merge

一句白话：

- 主线身份归 `dev-master`
- `CMP` 的高风险实现主体归 `cmp/mp`

## 当前最推荐下一步

当前最推荐的下一步不是去碰 `main` / `deploy`。

而是：

1. 解完当前总装冲突
2. 跑：
   - `npm run typecheck`
   - `npm run build`
   - `npx tsx --test src/agent_core/runtime.test.ts`
   - `npx tsx --test src/rax/cmp-facade.test.ts`
3. 再决定是否把这条整合线推进成新的正式 `dev-master` 继续线

## 给后续 Codex 的一句提示

如果后续 Codex 读到这个文件，默认把当前对象理解为：

- “正在把 `cmp/mp` 并回 `dev-master` 的总装阶段”

而不是：

- 继续只做 `dev-master` 的 low-risk shell
- 或继续只做 `cmp/mp` 的单线深挖
