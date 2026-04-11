# 2026-04-11 MP Swift Implementation Plan

## 背景

- 当前 Swift 侧已经有：
  - `PraxisInfraContracts` 中的 semantic memory / semantic search contract
  - `PraxisRuntimeComposition` 的 local SQLite-backed semantic memory / embedding / search baseline
  - `PraxisInspectMpUseCase` -> `PraxisMpFacade` -> `PraxisRuntimeInterface.inspectMp`
- 但当前 Swift 侧还没有：
  - 对等于 TS `mp-types` / `mp-runtime` / `mp-five-agent` / `mp-lancedb` 的独立 Swift 子域
  - MP workflow command surface
  - MP memory/search/readback dedicated neutral surface

一句话：

- Swift 现在只有 MP inspection，没有 MP workflow。

## 目标

把 MP 从 “inspection-only reserved surface” 推进成：

- 有独立 Core 语义
- 有独立 HostRuntime workflow surface
- 默认 local runtime 跑在现有 SQLite baseline 上
- 不把 TS 的 LanceDB 目录结构原样搬进 Swift

## 迁移总原则

### 1. 先复刻语义，不先复刻存储品牌

- TS 当前真值面是 `LanceDB`
- Swift macOS 本地默认真值面仍保持 `SQLite + local embedding/search baseline`

白话：

- 先把 memory workflow、scope、promotion、alignment、search plan 迁过来
- 不先为了“对齐 TS”把 Swift 也绑到 `LanceDB`

### 2. 先 workflow domain，再 host adapter

固定顺序：

1. MP shared models
2. MP workflow rules / search planning / scope governance
3. MP five-agent protocol
4. Host-neutral use case / facade / interface
5. local runtime adapter persistence/search upgrade

### 3. 不新建“大 MP Core”

- MP 相关 target 必须按职责拆开
- 不接受一个同时塞 memory types、search、workflow、adapter、facade 的粗模块

## 推荐 target 设计

### 一、Core / domain targets

#### `PraxisMpTypes`

承接：

- `MpScopeDescriptor`
- `MpMemoryRecord`
- freshness / alignment / confidence / ancestry
- session mode / visibility / promotion state

主要对照 TS：

- `src/agent_core/mp-types/mp-scope.ts`
- `src/agent_core/mp-types/mp-memory.ts`
- `src/agent_core/mp-types/mp-actions.ts`

#### `PraxisMpMemory`

承接：

- materialize / split / merge / archive / compact / reindex 的纯规则
- memory bundle / semantic group / supersede chain 语义

主要对照 TS：

- `src/agent_core/mp-runtime/materialization.ts`
- `src/agent_core/mp-lancedb/lancedb-lowering.ts`
- `src/agent_core/mp-lancedb/lancedb-maintenance.ts`

#### `PraxisMpSearch`

承接：

- search planner
- rerank
- scope enforcement
- session bridge access

主要对照 TS：

- `src/agent_core/mp-runtime/search-planner.ts`
- `src/agent_core/mp-runtime/scope-enforcement.ts`
- `src/agent_core/mp-runtime/session-bridge.ts`
- `src/agent_core/mp-runtime/runtime-types.ts`

#### `PraxisMpFiveAgent`

承接：

- `icma / iterator / checker / dbagent / dispatcher`
- workflow stage / handoff / observability summary
- align / resolve / requestHistory 的纯流程协议

主要对照 TS：

- `src/agent_core/mp-five-agent/types.ts`
- `src/agent_core/mp-five-agent/runtime.ts`
- `src/agent_core/mp-five-agent/observability.ts`
- `src/agent_core/mp-five-agent/configuration.ts`

### 二、HostContracts

不新增新的 provider-heavy contract family，优先复用已有：

- `PraxisInfraContracts`
  - semantic memory store
  - semantic search index
  - embedding store
- `PraxisProviderContracts`
  - embedding / inference
- `PraxisWorkspaceContracts`
  - source/body refs 对应的 workspace material

如确实不够，再补：

- `PraxisInfraContracts` 内的 MP-specific request/query envelope

不要单独新开一个 `PraxisMpContracts`。

### 三、HostRuntime

在现有结构内新增：

- `PraxisMpFacade`
  - 从 inspection 扩成 dedicated MP facade
- `PraxisRuntimeUseCases`
  - 新增 MP workflow / memory / search / readback use cases
- `PraxisRuntimeInterface`
  - 新增 MP neutral commands

## 推荐执行波次

### Wave MP-0：词表冻结

目标：

- 先冻结 Swift 版 MP 名词表和边界

产出：

- `PraxisMpTypes`
- 与 TS 对照测试样本

完成标准：

- Swift 有稳定 `memory / scope / freshness / alignment / promotion` 类型
- 不再继续把 MP 状态塞在 `PraxisInspectMpUseCase` 的字符串摘要里

### Wave MP-1：搜索与治理规则

目标：

- 先把 search / access / rerank 做成纯规则

产出：

- `PraxisMpSearch`
- scope enforcement tests
- session bridge tests
- rerank / supersede / stale filtering tests

完成标准：

- Swift 能在不接真实 UI 的情况下完成：
  - search plan
  - access decision
  - result rerank

### Wave MP-2：记忆化 workflow 规则

目标：

- 把 ingest / align / resolve / history 的纯规则链补齐

产出：

- `PraxisMpMemory`
- `PraxisMpFiveAgent`

完成标准：

- Swift 能表达：
  - ingest candidate -> checker review -> dbagent write intent -> dispatcher bundle
  - freshness / alignment / supersede 决策
- 仍不直接把宿主副作用塞进 domain

### Wave MP-3：HostRuntime surface

目标：

- 把 MP 从 inspect-only 扩成 dedicated neutral surface

建议 command family：

- `mpOpenSession`
- `mpIngest`
- `mpAlign`
- `mpResolve`
- `mpRequestHistory`
- `mpReadback`
- `mpSearch`
- `mpPromote`
- `mpArchive`
- `mpSplit`
- `mpMerge`
- `mpReindex`
- `mpCompact`
- `mpSmoke`

完成标准：

- `PraxisRuntimeInterface` 不再只有 `.inspectMp`
- `PraxisMpFacade` 成为 MP 主表面

### Wave MP-4：Local runtime 真执行

目标：

- 让现有 local runtime 真的能承接 MP workflow

策略：

- 继续使用当前 SQLite-backed semantic memory / embedding / search baseline
- 先补：
  - memory record persistence shape
  - search plan -> semantic search index query lowering
  - workflow write/readback persistence

完成标准：

- 本地 Swift runtime 可真实执行：
  - ingest
  - search
  - align
  - resolve
  - history/readback

### Wave MP-5：Provider-assisted enrichment

目标：

- 最后再接 embedding / inference 的外部 provider 增强

范围：

- provider embedding
- provider inference for align/checker assistance
- 可选 browser-grounded memory capture

完成标准：

- 没有 provider 时，local baseline 仍可运行
- 有 provider 时，只是增强，不是启动前置

## 测试要求

### 1. 纯规则测试优先

至少覆盖：

- scope validation
- promotion transition
- freshness decision
- supersede chain
- search rerank
- session bridge access
- five-agent handoff summary

### 2. HostRuntime surface contract tests

至少覆盖：

- runtime interface request validation
- facade snapshot mapping
- MP command error envelope
- local runtime smoke

### 3. TS 对照样本

优先建立对照样本：

- ingest -> align -> resolve
- stale / superseded rerank
- session bridge access
- project/global promotion

## 当前不做

- 不把 Swift 直接切到 `LanceDB`
- 不先做 MP GUI
- 不先把所有 `mp.*` 裸能力都暴露成 CLI 命令
- 不先做 provider 强依赖的在线工作流

## 推荐下一步

按最小可落地顺序，下一批直接做：

1. `PraxisMpTypes`
2. `PraxisMpSearch`
3. `PraxisRuntimeInterface` 新增 `mpSearch / mpReadback / mpSmoke`

原因：

- 这三步最容易验证
- 也能最快结束 “Swift 只有 inspectMp，没有 MP neutral surface” 的状态

## 已落地（2026-04-11 当日进展）

本轮已经完成上述最小批次：

- 新增 `PraxisMpTypes`
- 新增 `PraxisMpSearch`
- `PraxisRuntimeUseCases` 新增：
  - `searchMp`
  - `readbackMp`
  - `smokeMp`
- `PraxisMpFacade` 从 inspect-only 扩成：
  - `inspect`
  - `search`
  - `readback`
  - `smoke`
- `PraxisRuntimeInterface` 新增：
  - `.searchMp`
  - `.readbackMp`
  - `.smokeMp`
- `PraxisRuntimeGateway` / `PraxisRuntimePresentationBridge` blueprint 已纳入 MP domain modules
- 已补单元测试与 interface contract tests，并通过 `swift test`

### 当前结论

- Swift 侧已经不再是 “只有 inspectMp 的保留表面”
- MP 现在已有第一版 dedicated neutral surface
- MP 也已经有第一版纯子域：
  - `PraxisMpMemory`
  - `PraxisMpFiveAgent`
- 但还没有：
  - `mpIngest / mpAlign / mpResolve / mpRequestHistory / mpPromote` 等 workflow command family
  - HostRuntime 对 `PraxisMpMemory` / `PraxisMpFiveAgent` 的 command-level 承接

### 下一波建议顺序

1. 把 `search/readback/smoke` 之上的 domain 规则继续上提，避免 use case 里长期持有过多 lowering / mapping 逻辑
2. 新增 `mpIngest / mpAlign / mpResolve / mpRequestHistory`
3. 再根据接口负载决定是否补 `mpPromote / mpArchive / mpSplit / mpMerge`

## 已落地（2026-04-11 晚间补充）

本轮继续完成了 Wave MP-3 的第一批 command-level 接线：

- `PraxisRuntimeUseCases` 新增：
  - `ingestMp`
  - `alignMp`
  - `resolveMp`
  - `requestMpHistory`
- `PraxisMpFacade` 新增：
  - `ingest`
  - `align`
  - `resolve`
  - `requestHistory`
- `PraxisRuntimeInterface` 新增：
  - `.ingestMp`
  - `.alignMp`
  - `.resolveMp`
  - `.requestMpHistory`
- `PraxisRuntimeInterfaceSnapshotKind` 新增：
  - `.mpIngest`
  - `.mpAlign`
  - `.mpResolve`
  - `.mpHistory`

### 这轮的承接策略

- `ingestMp / alignMp`：
  - 使用 `PraxisMpFiveAgentRuntime` 承接纯 workflow judgement
  - 使用现有 `semanticMemoryStore` 作为 host-backed truth
  - HostRuntime 负责 `semanticMemoryRecord <-> mpMemoryRecord` lowering / rehydrate
- `resolveMp / requestMpHistory`：
  - 当前先走 host-backed `semanticMemoryStore.search`
  - 再接 `PraxisMpSearchPlanningService + PraxisMpSearchRankingService + PraxisMpWorkflowBundleService`
  - 也就是 retrieval 先以宿主真值面为主，不强行把所有 read path 都压进 `PraxisMpFiveAgentRuntime`

一句白话：

- 写入和对齐先过 five-agent judgement
- 检索和历史先过 host truth + MP planner/bundle

### 当前结论更新

- Swift 侧现在已经具备第一版 MP workflow command surface
- `PraxisRuntimeInterface` 不再只有 `inspectMp/searchMp/readbackMp/smokeMp`
- 本地 baseline 现在已经能真实执行：
  - `mpIngest`
  - `mpAlign`
  - `mpResolve`
  - `mpRequestHistory`
- 上述改动对应测试已补齐，并再次通过 `swift test`

### 下一步建议

1. 把 `mpPromote / mpArchive / mpSplit / mpMerge` 的优先级重新按真实调用面排一下，不要机械照搬 TS 面宽
2. 评估是否要给 `semanticMemoryStore` 增补更丰富的 MP-native read model，减少 use case 层的 lowering 胶水
3. 在保持 local baseline 可运行的前提下，再决定 `provider-assisted checker/alignment` 何时接入

## 已落地（2026-04-11 深夜补充）

这一轮继续把 MP 从“能 ingest/align/resolve/history”推进到“能显式 promotion/archive”。

### 一、semantic memory host truth 已承接 MP-native fields

`PraxisInfraContracts.PraxisSemanticMemoryRecord` 现在不再只是最小 host projection，而是直接承接：

- `sessionID`
- `sessionMode`
- `visibilityState`
- `promotionState`
- `sourceRefs`
- `tags`
- `semanticGroupID`
- `confidence`
- `lineagePath`
- `createdAt / updatedAt`
- `metadata`

同时：

- fake store 和 local SQLite-backed store 的 search / bundle 现在按真实 `sessionID` 过滤 session-scope 记录
- 默认隐藏 `visibilityState == .archived` 的记录
- `PraxisRuntimeUseCases` 里的 MP lowering 已优先读取这些 MP-native fields，而不是继续靠 `storageKey` 猜 session / scope / source

一句白话：

- HostRuntime 里的 semantic memory 真值层，现在终于能原生表达 MP 的 scope / visibility / promotion 语义了

### 二、HostRuntime surface 新增 `mpPromote / mpArchive`

本轮新增：

- `PraxisRuntimeUseCases`
  - `promoteMp`
  - `archiveMp`
- `PraxisMpFacade`
  - `promote`
  - `archive`
- `PraxisRuntimeInterface`
  - `.promoteMp`
  - `.archiveMp`
- `PraxisRuntimeInterfaceSnapshotKind`
  - `.mpPromote`
  - `.mpArchive`

### 三、当前 promotion/archive 规则

当前先采用“窄而明确”的 host-backed workflow，而不是把 TS 的 maintenance 面一口气全搬来：

- `mpPromote`
  - 显式依赖 `PraxisMpPromotionState` 状态迁移
  - 通过 `PraxisMpScopeDescriptor.assertPromotionTransition` 保证不允许逆向跳转
  - 按 target state 重写：
    - `submitted_to_parent`
    - `accepted_by_parent`
    - `promoted_to_project`
    - `promoted_to_global`
  - 并同步更新 scope/session/visibility/promotion/updatedAt/metadata
- `mpArchive`
  - 不删除 persisted truth
  - 只把 record 迁到 `visibilityState = archived`
  - 同步把 `promotionState = archived`
  - 因为 search/bundle 默认隐藏 archived，所以归档后自然从默认读取面消失

一句白话：

- archive 现在是“软隐藏但保留真值”
- promote 现在是“显式状态机推进，不是随手改一个 scope 字段”

### 四、验证

- `swift test`
  - 200 tests
  - 51 suites
  - 全通过

### 五、下一步建议

1. 把 `mpPromote / mpArchive` 里目前仍留在 use case 的状态迁移逻辑继续上提到 `PraxisMpMemory`
2. 再决定 `mpSplit / mpMerge` 是否真的需要先做，以及它们是 maintenance 命令还是 workflow 子动作
3. 如果后面要接 provider-assisted checker/alignment，就让 provider 只增强 judgement，不反过来定义 host truth

## 已落地（2026-04-11 深夜再补充）

这一轮完成了上面第 1 条，也就是把 `mpPromote / mpArchive` 的状态迁移规则继续从 HostRuntime 上提到了 `PraxisMpMemory`。

### 一、`PraxisMpMemory` 新增 governance service

新增纯规则 service：

- `PraxisMpMemoryGovernanceService`

它现在负责：

- promotion state transition validation
- target scope/session/visibility remapping
- archive state materialization
- governance metadata 回填

也就是：

- `submitted_to_parent`
- `accepted_by_parent`
- `promoted_to_project`
- `promoted_to_global`
- `archived`

这些迁移不再由 `PraxisRuntimeUseCases` 自己拼 scope 结构。

### 二、HostRuntime 现在只保留宿主接线职责

`PraxisPromoteMpUseCase / PraxisArchiveMpUseCase` 现在的职责已经收窄成：

1. 从 `semanticMemoryStore` 读取 persisted truth
2. lower 成 `PraxisMpMemoryRecord`
3. 调 `PraxisMpMemoryGovernanceService`
4. 再写回 `semanticMemoryStore`

一句白话：

- 规则回到 MP domain
- HostRuntime 只做宿主读写和 DTO lowering

### 三、纯规则测试已补

`PraxisMpMemoryTests` 新增了：

- promotion 跨 `submitted_to_parent -> accepted_by_parent -> promoted_to_project` 的测试
- archive 保留 scope identity 且切换到 archived visibility 的测试

### 四、验证更新

- `swift test`
  - 202 tests
  - 51 suites
  - 全通过

### 五、当前下一步建议

1. 如果继续沿同一方向推进，下一步优先把 `mpSplit / mpMerge` 的语义判断放进 `PraxisMpMemory`
2. 在真正加命令前，先决定 split/merge 是 maintenance workflow 还是 retrieval 辅助动作
3. `PraxisRuntimeUseCases.PraxisMpUseCaseImplementations` 里剩下的 lowering / mapping 逻辑，后面可以继续按 search / governance / write-path 分批上提

## 已落地（2026-04-11 深夜第三次补充）

这一轮继续沿着上面的建议推进，但先只做纯规则，不急着把命令面接出来。

### 一、`PraxisMpMemory` 已补 split / merge maintenance 规则

新增了两组纯 domain model：

- `PraxisMpSplitMemoryInput / PraxisMpSplitMemoryResult`
- `PraxisMpMergeMemoriesInput / PraxisMpMergeMemoriesResult`

并新增：

- `PraxisMpMemoryMaintenanceService`

当前它负责两件事：

1. `split`
   - 把一条 source memory 拆成多个 derived chunk
   - 保留 `parentMemoryID / derivedFromIDs / splitFromIDs`
   - 继承 scope / tags / semanticGroupID
   - 按 chunk index 派生 `id / storageKey / summary`
   - 将 `sourceRefs` 轮转分配到各 chunk
2. `merge`
   - 把多个 sibling memories 合成一条 merged memory
   - 汇总 `sourceRefs / tags`
   - 生成 `mergedFromIDs / derivedFromIDs / splitFromIDs`
   - 同时产出一个 `PraxisMpSemanticBundle`

一句白话：

- split/merge 现在已经有 Swift 版纯规则真相
- 但还没有被提前包装成 HostRuntime command

### 二、这轮的边界选择

当前刻意保持为“非破坏性 maintenance”：

- `split` 不自动归档 source memory
- `merge` 不自动归档 source memories

原因是：

- archive / compact 已经是独立治理动作
- 这样 split/merge 可以先作为纯语义派生规则稳定下来
- 后面是否需要 `mpCompact` 或 “merge 后自动 archive sources”，可以再单独设计

### 三、测试已补

`PraxisMpMemoryTests` 新增了：

- split 会生成带 ancestry 的 derived chunks
- merge 会生成 merged memory 与 semantic bundle，且不隐式归档 source

### 四、验证更新

- `swift test`
  - 204 tests
  - 51 suites
  - 全通过

### 五、当前下一步建议

1. 如果继续推进，下一步优先决定 split/merge 是否需要上升为 `mpSplit / mpMerge` host-neutral commands
2. 如果要接命令面，建议保持现在的非破坏性语义，并把 archive/compact 继续分开
3. 如果暂时不接命令面，可以先继续把 use case 里的 search/readback lowering 胶水往 `PraxisMpSearch / PraxisMpMemory` 上提

## 已落地（2026-04-11 深夜第四次补充）

这一轮按上面第 3 条继续推进，也就是先不上 `mpSplit / mpMerge` 命令面，而是继续把 `search/readback` 里的 projection / summary / breakdown 胶水从 HostRuntime use case 往 MP 纯子域上提。

### 一、`PraxisMpSearch` 新增 search projection service

新增：

- `PraxisMpSearchProjectionHit`
- `PraxisMpSearchProjection`
- `PraxisMpSearchProjectionService`

当前职责：

- 把 `PraxisMpSearchHit` flatten 成稳定的 host-neutral read model
- 统一产出：
  - `memoryID`
  - `agentID`
  - `scopeLevel`
  - `memoryKind`
  - `freshnessStatus`
  - `alignmentStatus`
  - `summary`
  - `storageKey`
  - `semanticScore`
  - `finalScore`
  - `rankExplanation`
- 统一生成 search summary 文本

一句白话：

- search 的“结果投影长什么样”现在不再由 use case 自己拼了，而是回到 `PraxisMpSearch`。

### 二、`PraxisMpMemory` 新增 readback projection service

新增：

- `PraxisMpReadbackProjection`
- `PraxisMpReadbackProjectionService`

当前职责：

- 基于 MP records 统一生成：
  - `totalMemoryCount`
  - `primaryCount`
  - `supportingCount`
  - `omittedSupersededCount`
  - `freshnessBreakdown`
  - `alignmentBreakdown`
  - `scopeBreakdown`
- 统一生成 readback summary 文本

一句白话：

- readback 的“统计口径和摘要话术”也不再散落在 HostRuntime use case 里了。

### 三、HostRuntime 继续收窄为接线层

`PraxisSearchMpUseCase / PraxisReadbackMpUseCase` 这轮继续收窄成：

1. 读 host truth
2. lower 成 `PraxisMpMemoryRecord`
3. 调 MP domain service 做 ranking / projection
4. 再映射回 runtime result DTO

也就是：

- search/readback 还没有完全脱离 lowering
- 但 summary / breakdown / flattened hit projection 已经移出 HostRuntime

### 四、这一轮的意义

这轮没有增加新的 command family，但继续改善了边界：

- `PraxisRuntimeUseCases` 不再持有更多 MP-specific summary 拼装细节
- `PraxisMpSearch / PraxisMpMemory` 现在不只负责规则，也开始承接稳定 read model projection
- 后面如果要加 `mpSplit / mpMerge` 命令，HostRuntime 可以直接复用现成的 maintenance / projection 子域，而不必继续扩 use case 内联逻辑

### 五、验证更新

- `swift test`
  - 206 tests
  - 51 suites
  - 全通过

### 六、当前下一步建议

1. 继续把 `PraxisMpUseCaseImplementations` 里剩下的 lowering helper 按 search/read/write-path 分批上提
2. 在命令面保持克制的前提下，评估 `mpSplit / mpMerge` 是否真的需要对外暴露
3. 如果后面要补 `mpCompact / mpReindex`，优先仍放在 `PraxisMpMemory` 的 maintenance 规则层，而不是直接堆到 HostRuntime

## 已落地（2026-04-11 深夜第五次补充）

这一轮继续按“先收口 helper，再决定后续命令面”的方向推进，把原来散落在 `PraxisMpUseCaseImplementations.swift` 顶部的一批 file-private lowering / request-building helper 正式提成了独立的 host-side service。

### 一、`PraxisRuntimeUseCases` 新增 `PraxisMpHostLoweringService`

新增：

- `PraxisMpHostLoweringService`

当前它负责三类 host-only 事情：

1. semantic memory request lowering
   - `PraxisMpSearchPlan -> PraxisSemanticMemorySearchRequest`
   - `PraxisMpSearchPlan -> PraxisSemanticMemoryBundleRequest`
   - `PraxisMpScopeLevel -> PraxisMemoryScopeLevel`
2. semantic truth <-> MP truth conversion
   - `PraxisSemanticMemoryRecord -> PraxisMpMemoryRecord`
   - `PraxisMpMemoryRecord -> PraxisSemanticMemoryRecord`
3. ingest host artifact support
   - scope descriptor reconstruction from ingest command
   - normalized timestamp
   - artifact id
   - storage key
   - stored artifact payload

一句白话：

- 这些逻辑现在不再是 `PraxisMpUseCaseImplementations.swift` 里的一排隐性全局函数了，而是有明确职责的 HostRuntime service。

### 二、MP use case 现在更像真正的 use case

`PraxisSearchMpUseCase / PraxisReadbackMpUseCase / PraxisIngestMpUseCase / PraxisAlignMpUseCase / PraxisResolveMpUseCase / PraxisRequestMpHistoryUseCase / PraxisPromoteMpUseCase / PraxisArchiveMpUseCase` 现在都改成显式依赖 `PraxisMpHostLoweringService`。

这意味着：

- use case 只负责 orchestration
- request lowering / record rehydrate / persistence lowering 都不再直接内联在用例文件里

一句白话：

- `PraxisRuntimeUseCases` 没有被继续长成“大总装器”，而是继续把 MP 相关 host glue 拆开了。

### 三、这轮新增了直接的 lowering tests

`PraxisRuntimeUseCasesTests` 新增：

- `mpHostLoweringServiceRoundTripsSemanticMemoryTruthAndRequests`
- `mpHostLoweringServicePersistsAndReloadsSeedRecords`

覆盖点包括：

- semantic truth 与 MP truth 的 round-trip
- search / bundle request lowering
- ingest scope / storage key lowering
- host persistence 后的 seed reload

### 四、验证更新

- `swift test`
  - 208 tests
  - 51 suites
  - 全通过

### 五、当前下一步建议

1. 继续把 `PraxisMpUseCaseImplementations` 里剩下的 `roleCounts / roleStages / bundle scope` 这类 host glue 再往明确的 support type 上提
2. 如果之后要接 `mpSplit / mpMerge` 命令面，优先复用现有 `PraxisMpMemoryMaintenanceService + PraxisMpHostLoweringService`，不要把 lowering 重新散回 use case
3. 如果要进一步缩薄 HostRuntime，可以再评估 `Resolve/History` 的 shared host orchestration 是否值得提成独立 service

## 已落地（2026-04-11 深夜第六次补充）

这一轮继续沿着上面第 3 条推进，把 `Resolve / History` 之间重复的 host-side retrieval orchestration 抽成了独立 service。

### 一、`PraxisRuntimeUseCases` 新增 `PraxisMpHostRetrievalService`

新增：

- `PraxisMpHostRetrievalService`

当前它负责：

- 从 `semanticMemoryStore` 读取 host truth
- 用 `PraxisMpHostLoweringService` 重建 `PraxisMpMemoryRecord`
- 用 `PraxisMpSearchRankingService` 做 retrieval ranking
- 用 `PraxisMpWorkflowBundleService` 组装 `PraxisMpWorkflowBundle`
- 输出固定的 dispatcher telemetry：
  - `roleCounts`
  - `roleStages`

一句白话：

- `resolve/history` 现在不再各自手写一遍 “search -> rehydrate -> rank -> bundle” 了。

### 二、`Resolve / History` use case 继续变薄

`PraxisResolveMpUseCase / PraxisRequestMpHistoryUseCase` 现在只剩：

1. 组 plan
2. 调 `PraxisMpHostRetrievalService`
3. 生成各自的 summary / issues / result DTO

这意味着：

- retrieval 的 shared orchestration 已经不再散在 use case 里
- `PraxisMpUseCaseImplementations.swift` 又变薄了一层

### 三、这轮新增了 direct retrieval test

`PraxisRuntimeUseCasesTests` 新增：

- `mpHostRetrievalServiceBuildsWorkflowBundleAndDispatcherTelemetry`

覆盖点包括：

- retrieval bundle 的 primary / supporting 组装
- dispatcher telemetry 的固定输出
- 当前 `resolve/history` 默认在 ranking 阶段过滤 superseded memory 的语义

### 四、验证更新

- `swift test`
  - 209 tests
  - 51 suites
  - 全通过

### 五、当前下一步建议

1. 继续把 `PraxisMpUseCaseImplementations` 里剩下的纯 DTO summary 组装与 issue 生成，按 inspect/search/read/write-path 再拆成 support service
2. 如果后续进入 `mpSplit / mpMerge` 命令面，优先让它们复用现有 `PraxisMpMemoryMaintenanceService + PraxisMpHostLoweringService`，不要直接在 use case 里重写 retrieval / persistence 流程
3. 如果要进一步提高 resolve/history 的真实感，再考虑让 `PraxisMpHostRetrievalService` 可选接入 semantic search score，而不是继续只跑 governance-only ranking

## 已落地（2026-04-11 深夜第七次补充）

这一轮把上面第 3 条也推进了，也就是让 `PraxisMpHostRetrievalService` 在有 `semanticSearchIndex` 的情况下，开始吃真正的 semantic score。

### 一、`PraxisMpHostRetrievalService` 现在支持可选 semantic rerank

新增行为：

- 当 `semanticSearchIndex` 存在，且 query 非空、候选 storage key 非空时：
  - 先向 `semanticSearchIndex` 拉一轮 `PraxisSemanticSearchMatch`
  - 按 `storageKey -> score` 合并成 semantic score map
  - 再把这些 score 交给 `PraxisMpSearchRankingService`

当前仍保留：

- 没有 `semanticSearchIndex` 时，继续退回 governance-only ranking
- 也就是说语义分数是增强层，不是运行前置

一句白话：

- `resolve/history` 现在终于不再永远只靠 freshness/alignment 做排序了
- 有 semantic search 时，会真正利用语义分数

### 二、`Resolve / History` 已接到可选 semantic rerank

`PraxisResolveMpUseCase / PraxisRequestMpHistoryUseCase` 现在都会把 `dependencies.hostAdapters.semanticSearchIndex` 传给 `PraxisMpHostRetrievalService`。

这意味着：

- shared retrieval orchestration 仍然只保留一份
- 但 retrieval signal 已经从 “仅治理规则” 升级成 “语义分数 + 治理规则”

### 三、这轮新增了 direct semantic retrieval test

`PraxisRuntimeUseCasesTests` 新增：

- `mpHostRetrievalServiceUsesSemanticSearchScoresWhenAvailable`

覆盖点：

- 两条 freshness/alignment 相同的 memory
- 通过 semantic score 让高分 memory 成为 primary
- 确认 shared retrieval service 的排序真的会受 semantic score 影响

### 四、验证更新

- `swift test`
  - 210 tests
  - 51 suites
  - 全通过

### 五、当前下一步建议

1. 如果继续瘦身 `PraxisMpUseCaseImplementations.swift`，下一步优先把 search/readback/resolve/history 的 summary 与 issue 文案收口成 diagnostics service
2. 如果接下来要做 `mpSplit / mpMerge` 命令面，优先让新命令直接复用现有 maintenance + lowering + retrieval support，而不是新开一套 use case 内联流程
3. 如果后续要做更强的 MP retrieval，可继续评估把 `readback` 也接上 semantic score，而不是只让 `resolve/history` 吃这层增强

## 已落地（2026-04-12 凌晨第八次补充）

这一轮继续按“瘦 use case、把 MP 宿主胶水提成 support service”的方向推进，不过重点从 retrieval 转到了 inspect / smoke。

### 一、新增 `PraxisMpHostDiagnosticsService`

本轮先补了一个新的 host-side support service：

- `Sources/PraxisRuntimeUseCases/PraxisMpHostDiagnostics.swift`

它负责把原来散在 `PraxisMpUseCaseImplementations.swift` 里的这些稳定文案收口：

- missing semantic memory store 的 summary / issue
- semantic search fallback issue
- `smoke / ingest / align / resolve / history / promote / archive` 的 summary

一句白话：

- 现在 MP mutation / retrieval 的人类可读文案，不再散在 use case 里手写。

### 二、`PraxisMpUseCaseImplementations.swift` 继续变薄

`PraxisSearchMpUseCase / PraxisReadbackMpUseCase / PraxisSmokeMpUseCase / PraxisIngestMpUseCase / PraxisAlignMpUseCase / PraxisResolveMpUseCase / PraxisRequestMpHistoryUseCase / PraxisPromoteMpUseCase / PraxisArchiveMpUseCase`

现在都改为依赖 `PraxisMpHostDiagnosticsService`，不再自己拼这些 summary / issue 字符串。

这意味着：

- MP use case 进一步回到 orchestration 角色
- wording 与 fallback 逻辑开始形成稳定 host-side surface

### 三、inspect / smoke 也被抽成独立 support service

这轮进一步新增：

- `Sources/PraxisRuntimeUseCases/PraxisMpHostInspection.swift`

它负责：

- `smokeMp` 的 runtime gate 检查与 `PraxisRuntimeSmokeCheckRecord` 投影
- `inspectMp` 的 workflow / memory store / multimodal summary
- inspect 期的 issue 组装

对应地：

- `PraxisSmokeMpUseCase` 不再自己内联 4 条 smoke checks
- `PraxisInspectMpUseCase` 不再在 `PraxisUseCaseImplementations.swift` 里直接拼 MP inspection 文案和 issue

一句白话：

- 现在 `inspectMp` 和 `smokeMp` 也终于从“大 use case 文件里的最后一坨 MP 宿主判断”里拆出来了。

### 四、测试补齐

`PraxisRuntimeUseCasesTests` 新增 direct tests：

- `mpHostDiagnosticsServiceBuildsStableFallbackIssuesAndSummaries`
- `mpHostDiagnosticsServiceBuildsStableMutationAndRetrievalSummaries`
- `mpHostInspectionServiceBuildsSmokeChecksFromAdapterReadiness`
- `mpHostInspectionServiceBuildsInspectionProjectionFromHostTruth`

覆盖点包括：

- diagnostics wording 的稳定输出
- smoke gate 的 status / summary
- inspection summary / multimodal summary / issues 的稳定投影

### 五、验证更新

- `swift test`
  - 214 tests
  - 51 suites
  - 预期全通过

### 六、当前下一步建议

1. 如果继续推进，下一步优先考虑把 `inspectMp/searchMp/readbackMp` 共享的 fallback / issue 进一步按 “inspection vs retrieval” 再分成更清晰的 support surface，而不是继续把细节塞回 use case
2. 如果之后要放出 `mpSplit / mpMerge` 命令面，优先直接复用现有 `maintenance + lowering + retrieval` support，而不是另起一套 persistence / bundle 流程
3. 如果要继续提高 inspection 的真实度，可再评估让 `inspectMp` 读取更多 host truth（例如 memory record sample / recent bundle slice），但应保持它是 inspection，不要变成另一个 readback

## 已落地（2026-04-12 凌晨第九次补充）

这一轮继续收口 MP retrieval surface，把 `searchMp / readbackMp` 里剩下那段宿主候选读取和 semantic-search fallback 胶水也提走了。

### 一、`PraxisMpHostRetrievalService` 新增 candidate snapshot

这轮新增：

- `PraxisMpHostCandidateSnapshot`
- `PraxisMpHostRetrievalService.candidateSnapshot(...)`

它统一负责：

- 从 host-backed semantic memory truth 读取候选 records
- lowering 成 `PraxisMpMemoryRecord`
- 按需拉取 semantic score
- 生成稳定的 retrieval fallback issue

一句白话：

- 现在 search/readback 不再自己碰 `semanticMemoryStore.search + semanticSearchIndex.search + fallback issue` 这一整段宿主细节。

### 二、`searchMp / readbackMp` use case 继续变薄

`PraxisSearchMpUseCase` 现在直接吃 `candidateSnapshot`：

- 自己只保留 planner
- domain ranking
- domain projection
- DTO flatten

`PraxisReadbackMpUseCase` 现在也直接吃 `candidateSnapshot`：

- 自己只保留 planner
- host bundle count 读取
- domain readback projection

这意味着：

- retrieval fallback wording 已经和 retrieval read path 放在同一个 support surface
- `PraxisMpUseCaseImplementations.swift` 继续从 “宿主搜索接线” 回到 “薄 orchestration”

### 三、direct tests 补齐

`PraxisRuntimeUseCasesTests` 新增：

- `mpHostRetrievalServiceBuildsCandidateSnapshotWithSemanticScores`
- `mpHostRetrievalServiceBuildsCandidateSnapshotWithFallbackIssueWhenSemanticSearchIsMissing`

覆盖点包括：

- candidate snapshot 会把 semantic score 正确按 `storageKey` 带回
- 没有 semantic search 时，会产出稳定 fallback issue
- lowered candidate records 顺序和数量保持可预期

### 四、当前下一步建议

1. 如果继续往下推，下一步优先考虑把 `PraxisInspectMpUseCase` 也完全迁到 MP 专属实现文件，进一步缩小 `PraxisUseCaseImplementations.swift`
2. 如果要继续做 retrieval side 的瘦身，可以把 search result DTO flatten 也提成 host-side mapper，但前提是不要把 domain projection 重新吞回 HostRuntime
3. `mpSplit / mpMerge` 仍然建议放到后面，等 inspection / retrieval / mutation 三条 support surface 完整稳定后再决定要不要放出 neutral command

## 已落地（2026-04-12 凌晨第十次补充）

这一轮没有再加新命令，而是继续收紧文件边界，把 MP inspection 的入口实现也迁回了 MP 专属文件。

### 一、`PraxisInspectMpUseCase` 已迁回 MP 专属实现文件

本轮改动：

- `PraxisInspectMpUseCase` 从 `Sources/PraxisRuntimeUseCases/PraxisUseCaseImplementations.swift`
- 迁移到 `Sources/PraxisRuntimeUseCases/PraxisMpUseCaseImplementations.swift`

行为保持不变：

- 仍然复用 `PraxisMpHostInspectionService`
- 仍然通过 `inspectMp` 读取当前 host-backed MP inspection snapshot

一句白话：

- 现在总 use case 文件里已经不再挂着 MP inspection 的入口实现了，MP surface 的入口更集中。

### 二、当前边界状态更清晰

到这一轮为止，MP 这几类 host-side support 已经各自成形：

- inspection: `PraxisMpHostInspectionService`
- diagnostics: `PraxisMpHostDiagnosticsService`
- lowering: `PraxisMpHostLoweringService`
- retrieval: `PraxisMpHostRetrievalService`

对应的 MP use case 也越来越像薄 orchestrator，而不是继续长回第二个总编排器。

### 三、当前下一步建议

1. 如果继续推进，下一步优先考虑把 `search` 命中的 DTO flatten 再提成小型 mapper/service，让 `PraxisSearchMpUseCase` 只保留 planner + rank + project
2. 如果后续要给 `readback` 增强真实度，可以评估是否让它也可选读取一小段 representative sample，但要避免和 inspection/readback 边界混掉
3. `mpSplit / mpMerge` 仍建议放后面，等当前 inspection / retrieval / mutation / maintenance 的 support surface 都稳定以后再决定要不要出 neutral commands

## 已落地（2026-04-12 凌晨第十一次补充）

这一轮继续做 `searchMp` 的最后一层薄化，把 search projection 到 use-case DTO 的 flatten 映射也拿出了 use case。

### 一、新增 `PraxisMpHostResultMappingService`

新增文件：

- `Sources/PraxisRuntimeUseCases/PraxisMpHostResultMapping.swift`

当前先承接：

- `PraxisMpSearchProjection -> PraxisMpSearchResult`
- `PraxisMpSearchProjectionHit -> PraxisMpSearchHitRecord`

一句白话：

- domain search projection 还是留在 `PraxisMpSearch`
- HostRuntime 只多了一个很薄的“最后一跳 DTO 映射器”

### 二、`PraxisSearchMpUseCase` 继续变薄

现在 `PraxisSearchMpUseCase` 自己只保留：

- planner
- candidate snapshot retrieval
- ranking
- projection

最终 `PraxisMpSearchResult` 的 DTO flatten 已经交给 `PraxisMpHostResultMappingService`。

这意味着：

- search use case 更接近纯 orchestration
- 也避免后续 facade / runtime interface 再到处复制这层 hit flatten 逻辑

### 三、direct test 补齐

`PraxisRuntimeUseCasesTests` 新增：

- `mpHostResultMappingServiceBuildsSearchResultFromProjection`

覆盖点：

- search result summary 透传
- projected hit 到 host-neutral hit DTO 的字段映射
- issue 列表透传

### 四、当前下一步建议

1. 如果继续往下推，下一步优先考虑把 `readback` 的 host-neutral result shaping 也抽成对应 mapper，让 `PraxisReadbackMpUseCase` 只剩 planner + retrieval + projection
2. 如果要继续收边界，可以再检查 facade 层是否仍有可共用的 MP flatten 逻辑，但不要把 facade-specific DTO 投影重新塞回 use case
3. `mpSplit / mpMerge` 仍建议放后面，等当前 search/readback/inspect/mutation support surface 稳住以后再决定是否出 neutral command

## 已落地（2026-04-12 凌晨第十二次补充）

这一轮把上一条建议也落实了，也就是把 `readbackMp` 的 host-neutral result shaping 从 use case 里抽成了 mapper。

### 一、`PraxisMpHostResultMappingService` 现在同时承接 search / readback

在原有 search 映射基础上，这轮新增：

- `PraxisMpReadbackProjection -> PraxisMpReadback`

一句白话：

- 现在 `PraxisMpHostResultMappingService` 不只负责 search hit/result flatten，也开始承接 readback 的最后一跳 DTO 映射。

### 二、`PraxisReadbackMpUseCase` 继续变薄

`PraxisReadbackMpUseCase` 现在只保留：

- planner
- candidate snapshot retrieval
- host bundle count 读取
- domain readback projection

最终 `PraxisMpReadback` 的字段组装已经交给 `PraxisMpHostResultMappingService`。

这意味着：

- `readback` 和 `search` 的 host-neutral result shaping 终于有了统一的落点
- use case 进一步回到 orchestration 角色

### 三、direct test 补齐

`PraxisRuntimeUseCasesTests` 新增：

- `mpHostResultMappingServiceBuildsReadbackResultFromProjection`

覆盖点：

- summary / count / breakdown / issues 的透传
- projected readback model 到 host-neutral readback DTO 的稳定映射

### 四、当前下一步建议

1. 如果继续推进，下一步优先考虑检查 facade 层是否还有可共用的 MP flatten 逻辑，再决定要不要抽 facade-side mapper
2. 如果还想继续瘦 use case，下一步更合理的是审视 `resolve/history` 的 summary/result 组装是否需要一个很薄的 mapper，而不是马上开 `mpSplit / mpMerge`
3. `mpSplit / mpMerge` 仍建议放后面，等 inspection / search / readback / mutation / maintenance 这几条 support surface 稳定以后再决定是否放出 neutral command

## 已落地（2026-04-12 凌晨第十三次补充）

这一轮不是继续扩面，而是回头修正 MP host workflow 上已经暴露出来的三个真实缺陷。

### 一、`align` 现在会校验 memory 的 project ownership

此前 `PraxisAlignMpUseCase` 只按 `memoryID` 加载记录，然后直接写回更新后的结果。

这会导致：

- 调用方可以传入 `projectID = A`
- 同时给一个实际属于 `project B` 的 `memoryID`
- 最终在 `A` 的 runtime 上修改 `B` 的 memory truth

现在 `align` 已改为复用和 `promote/archive` 一样的 ownership guard，先验证 `memory.projectID == command.projectID`，不匹配就拒绝。

### 二、`resolve/history` 不再把 shared bundle 读取错误收窄到 requester agent

此前 `PraxisResolveMpUseCase` 和 `PraxisRequestMpHistoryUseCase` 会把：

- `requesterAgentID`

继续下传给 MP search plan，再影响到底层 semantic memory 检索与 ranking。

这会导致：

- 某个 agent A 把 memory promote 到 `project/global`
- 记录本身仍保留 author = A
- agent B 读取 shared bundle 时又被加上 `agentID == B` 过滤
- 最终 project/global 的 peer-shared memory 被静默排除

现在 `resolve/history` 对 shared bundle 检索不再传入 agent filter，只保留 requester session 语义，跨 agent 的 project-shared memory 可以正常进入 bundle。

### 三、superseded omission diagnostics 现在基于 pre-rank snapshot 计算

此前 `PraxisMpHostRetrievalService.bundle(...)` 先调用 ranking，把 superseded memory 过滤掉，再让 `PraxisMpWorkflowBundleService.assemble(...)` 计算 diagnostics。

这会导致：

- 真正被 supersede 掉的候选记录已经在 pre-bundle 阶段消失
- `omittedSupersededMemoryIDs` 总是空列表

现在 retrieval service 会在 candidate snapshot 阶段就保留 superseded memory ID 列表，并显式传给 workflow bundle 组装层，所以 diagnostics 能反映真实被省略的 superseded 记录。

### 四、direct test 补齐

这轮新增或更新了以下覆盖：

- `mpAlignUseCaseRejectsMemoryFromDifferentProject`
- `mpResolveAndHistoryReadSharedProjectMemoriesAcrossAgents`
- `mpHostRetrievalServiceBuildsWorkflowBundleAndDispatcherTelemetry`（更新为校验 superseded omission diagnostics）

### 五、验证结果

本轮已执行：

- `swift test`

结果：

- `220 tests / 51 suites` 全通过

### 六、当前下一步建议

1. 继续推进前，先把当前 MP host support surface 的边界保持稳定，不要一边修缺陷一边再把 search / retrieval / diagnostics 胶水重新塞回 use case
2. 如果继续扩面，优先考虑 `resolve/history` 最后一层 result shaping 是否还值得再抽成更薄的 mapper；如果收益不大，就停止继续碎拆
3. `mpSplit / mpMerge` 仍然可以后置，先保证现有 shared retrieval / governance / diagnostics 语义稳定
