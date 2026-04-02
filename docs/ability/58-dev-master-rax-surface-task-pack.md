# Dev-Master RAX Surface Task Pack

状态：第二批受控施工任务包 / `rax` 专项。

更新时间：2026-04-02

## 这份文档回答什么

这份文档专门回答：

- `rax` 这一层到底已经接回了什么，还缺什么。
- 为什么当前最安全的下一步是先做 `rax`，而不是直接碰 `runtime assembly`。
- `rax` 这层应该怎样拆成可控的小步，而不是一次性全接。

一句白话：

- 这份文档不是再讲“为什么先做 `rax`”。
- 它是把 `rax` 的下一轮施工面拆成可真正开工的任务包。

## 当前已确认的事实

### 1. `rax` 不是一整块都没接回来

当前新 `dev` 已经具备：

- `src/rax/cmp-domain.ts`
- `src/rax/cmp-connectors.ts`
- `src/rax/index.ts` 里已经有：
  - `CmpConnectorOwnership`
  - `CmpPostgresConnector`
  - `CmpRedisConnector`
  - `CmpSharedGitInfraConnector`
  - `CmpSharedInfraConnectors`
  - `createCmpSharedGitInfraConnector`
  - `createCmpPostgresConnector`
  - `createCmpRedisConnector`
  - `createCmpSharedInfraConnectors`
  - `CmpSection*`
  - `CmpRule*`
  - `createCmpSection`
  - `createCmpStoredSection`
  - `createCmpRule`
  - `createCmpRulePack`
  - `evaluateCmpRulePack`

白话：

- `CMP` 的 domain 与 connectors 这部分，其实已经提前进主线了
- 所以当前 `rax` 的真实缺口比最初想象的更小

### 2. `rax` 当前真正缺的是 5 个点

在最初拆包时，当前还没有接回主线的是：

- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-facade.ts`

以及对应测试：

- `src/rax/cmp-runtime.test.ts`
- `src/rax/cmp-facade.test.ts`

补充核实：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-status-panel.ts`
- `src/rax/cmp-config.test.ts`
- `src/rax/cmp-status-panel.test.ts`

现已在新主线上并通过最小验证。

### 3. `src/rax/index.ts` 的缺口也已缩小

当前 `cmp/mp` 想额外接回的，主要是：

- `RaxCmp*` 类型
- `createRaxCmpConfig`
- `loadRaxCmpConfigFromEnv`
- `createCmpStatusPanelRows`
- `renderCmpStatusPanel`
- `createRaxCmpRuntime`
- `createRaxCmpFacade`

当前判断：

- `index.ts` 并不是“整体大改”
- 更像是围绕上述几个 `CMP` 出口做增量补齐

### 4. `cmp-runtime.ts` 不能按 `cmp/mp` 版本原样移植

这轮主线程已经核实：

- 当前新主线的 `src/agent_core/runtime.ts`
  还没有暴露 `cmp/mp` 版 `cmp-runtime.ts` 所依赖的那整组 `CMP` workflow 方法
- 当前 `src/agent_core/index.ts`
  也还没有把 `cmp-git / cmp-runtime / cmp-five-agent` 这些面整体导出
- 当前新主线甚至还没有 `src/agent_core/cmp-five-agent/**`

白话：

- `cmp-runtime.ts` 如果照 `cmp/mp` 原样搬回来，会直接踩到 runtime assembly 的未接线区
- 所以 `Phase B` 必须继续收窄，不能假装它已经是一个“纯低风险壳子”

## 当前不要做错的事

- 不要因为 `rax` 比 runtime 风险小，就把 `cmp-facade` 和 `cmp-runtime` 一起一把并上。
- 不要在还没接回 `cmp-types/cmp-config` 之前，就先让 `rax.cmp` facade 出现在总入口里。
- 不要在做 `rax` 的同时顺手碰 `src/agent_core/runtime.ts`。

## 推荐拆法

## Phase A. `rax` 基础出口补齐

范围：

- `src/rax/cmp-types.ts`
- `src/rax/cmp-config.ts`
- `src/rax/cmp-status-panel.ts`
- `src/rax/cmp-config.test.ts`
- `src/rax/cmp-status-panel.test.ts`
- `src/rax/index.ts`

目标：

- 先把 `CMP` 的类型、配置和状态面板能力补回主线
- 让外层开始拥有可读的 `CMP` 出口
- 但不碰 `cmp-runtime` / `cmp-facade`

最小验收：

- `npm run typecheck`
- `npx tsx --test src/rax/cmp-config.test.ts src/rax/cmp-status-panel.test.ts`

## Phase B. `rax.cmp` runtime

范围：

- `src/rax/cmp-runtime.ts`
- `src/rax/cmp-runtime.test.ts`
- `src/rax/index.ts`

目标：

- 先判断是否只能接一个“薄 runtime shell”
- 如果当前 `agent_core/runtime.ts` 还没有对应桥位，则：
  - 只允许接 connectors/runtime container 层
  - 不允许假装 workflow passthrough 已经就绪
- 仍不提前处理 facade

最小验收：

- `npm run typecheck`
- `npx tsx --test src/rax/cmp-runtime.test.ts`

## Phase C. `rax.cmp` facade

范围：

- `src/rax/cmp-facade.ts`
- `src/rax/cmp-facade.test.ts`
- `src/rax/index.ts`

目标：

- 在 `cmp-types/config/status-panel/runtime` 都站稳后，再接 facade
- 让上层最终拥有统一的 `rax.cmp` 使用面

最小验收：

- `npm run typecheck`
- `npx tsx --test src/rax/cmp-facade.test.ts`

## 多智能体写域建议

### Worker A. `cmp-types/config/status-panel`

只负责：

- Phase A

不负责：

- `cmp-runtime`
- `cmp-facade`
- `src/agent_core/runtime.ts`

### Worker B. `cmp-runtime`

只负责：

- Phase B 的薄 runtime shell
- 不能擅自补 `agent_core/runtime.ts`

不负责：

- `cmp-facade`
- `src/agent_core/runtime.ts`

### 主线程

负责：

- `src/rax/index.ts` 的最终仲裁
- Phase C 的 `cmp-facade`
- 判断何时允许进入 `runtime assembly`

## 当前完成定义

只有同时满足下面这些条件，才算 `rax` 这层真正站稳：

1. `cmp-types/config/status-panel` 已接回主线并通过最小验证。
2. `cmp-runtime` 已接回主线并通过最小验证。
3. `cmp-facade` 已接回主线，但仍未提前触碰 `agent_core/runtime.ts`。
4. `src/rax/index.ts` 已能对外清楚表达 `CMP` 的出口，而不是继续藏在 branch 里。

一句收口：

- 现在最安全的下一步，不是去撞 `runtime assembly`
- 而是先把 `rax` 这一层按：
  - Phase A `cmp-types/config/status-panel` 已完成
  - Phase B `thin runtime shell if possible`
  - Phase C `cmp-facade`
  逐层收回来
