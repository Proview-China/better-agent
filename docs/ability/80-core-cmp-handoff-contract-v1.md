# Core CMP Handoff Contract V1

状态：正式 contract 文档 / 对齐当前实现。

更新时间：2026-04-13

## 当前唯一目标

为 `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp` 当前已落地的 `core-cmp-context-package/v1` 冻结一份正式 handoff contract，只描述代码已经支持的事实和 core 端已经在执行的消费规则。

## 先说结论

当前 `core-CMP` handoff 的最小正式合同是：

- 包信封固定为 `core-cmp-context-package/v1`
- `deliveryStatus` 是第一消费开关
- `identity/objective/payload/governance` 是分组语义，不要求每组字段都齐
- `core` 永远先服从显式当前用户目标，再按 `deliveryStatus` 决定 CMP 能信多少

一句白话：

这份 contract 的核心不是“CMP 把一切都说全”，而是“core 在信息完整、不完整、未到达、跳过时都知道该怎么工作”。

## 一、Contract 范围

本 contract 约束的是：

- `src/agent_core/core-prompt/types.ts`
- `src/agent_core/core-prompt/live-chat-contextual.ts`
- `src/agent_core/core-prompt/contextual.ts`
- `src/agent_core/core-prompt/development.ts`
- `src/agent_core/core-prompt/live-chat-assembly.ts`
- `src/agent_core/live-agent-chat.ts`

本 contract 不约束：

- `CMP` 内部如何生成包
- 未来版本可能新增的字段
- deep overlay / memory / skill producer 的未来设计

## 二、正式信封

### 1. 顶层结构

`CMP` 回流到 `core` 的正式顶层信封是：

```ts
interface CoreCmpContextPackageV1 {
  schemaVersion: "core-cmp-context-package/v1";
  deliveryStatus: "available" | "partial" | "absent" | "pending" | "skipped";
  identity?: CoreCmpContextPackageIdentityV1;
  objective?: CoreCmpContextPackageObjectiveV1;
  payload?: CoreCmpContextPackagePayloadV1;
  governance?: CoreCmpContextPackageGovernanceV1;
}
```

### 2. 顶层最小必填

当前 v1 真正的顶层必填只有两个：

- `schemaVersion`
- `deliveryStatus`

理由：

- `types.ts` 只把这两个字段定义为必填
- `live-chat-contextual.ts` 在 `absent` 降级时也只保证最小 envelope 一定存在

### 3. 顶层分组原则

`identity/objective/payload/governance` 是语义分组，不是“每组必须完整填满”的强制表单。

当前 live producer 的事实是：

- `identity` 会填 package 身份信息
- `objective` 当前稳定产出 `taskSummary` 与 `requestedAction`
- `payload` 当前稳定产出 `backgroundContext` 与 `timelineSummary`
- `governance` 当前稳定产出 `operatorGuide/childGuide/checkerReason/routeRationale/scopePolicy/fidelityLabel/confidenceLabel/freshness`

也就是说，v1 已允许更丰富字段，但当前正式消费范围要以真实 producer 为准。

## 三、分组最小语义

## 1. `identity`

作用：

- 标识这是谁交来的包
- 让 core 知道这是不是一个可追踪、可引用的上下文对象

当前字段：

- `packageId`
- `packageRef`
- `packageKind`
- `packageMode`
- `projectionId`
- `snapshotId`

当前最小 contract：

- 当 `deliveryStatus=available` 或 `partial` 时，`identity.packageId` 和 `identity.packageRef` 应视为最小身份锚点
- 其余字段是增强信息，不是当前 core 消费前提

## 2. `objective`

作用：

- 告诉 core 这份包在说什么任务
- 告诉 core 交接方建议的下一步动作是什么

当前字段：

- `taskSummary`
- `currentObjective`
- `requestedAction`

当前 live producer 事实：

- `taskSummary` 来自 `CmpTurnArtifacts.intent`
- `requestedAction` 来自 `CmpTurnArtifacts.operatorGuide`
- `currentObjective` 目前保留在 schema 中，但 live producer 还没有稳定填它

当前最小 contract：

- `objective.taskSummary` 是包的摘要目标
- `objective.requestedAction` 是受治理约束的建议动作
- `objective.currentObjective` 不能被假定为当前一定存在

## 3. `payload`

作用：

- 提供当前可以帮助执行的现场内容

当前字段：

- `primaryContext`
- `backgroundContext`
- `timelineSummary`
- `constraints`
- `risks`
- `sourceAnchorRefs`

当前 live producer 事实：

- 当前稳定填的是 `backgroundContext` 与 `timelineSummary`
- 其余字段还停留在 schema 预留位

当前最小 contract：

- `payload` 在 v1 里是可选增强块
- core 当前不能假定 `primaryContext/constraints/risks/sourceAnchorRefs` 一定存在
- 缺这些字段时，不能把“没写”脑补成“没有约束/没有风险/没有锚点”

## 4. `governance`

作用：

- 告诉 core 这份包的可信度、治理边界和阅读姿势

当前字段：

- `operatorGuide`
- `childGuide`
- `checkerReason`
- `routeRationale`
- `scopePolicy`
- `confidenceLabel`
- `fidelityLabel`
- `freshness`

当前最小 contract：

- `operatorGuide` 是交接建议，不是强制覆盖指令
- `childGuide/checkerReason/routeRationale/scopePolicy` 是治理辅助信号
- `confidenceLabel` 和 `freshness` 是由 live producer 按 `deliveryStatus` 派生的消费提示

## 四、`deliveryStatus` 的正式语义

`deliveryStatus` 是 v1 最核心字段，因为 core 端消费纪律就是按它分流的。

## 1. `available`

正式语义：

- 当前 `CMP` 包已经到达
- 在 producer 当前检查的关键字段里，没有发现 `missing/pending/skipped` 哨兵值
- core 可以把它当成“当前可执行上下文”

当前代码依据：

- `inferCmpDeliveryStatus(...)` 默认落到 `available`
- `inferCmpConfidenceLabel(...) => high`
- `inferCmpFreshness(...) => fresh`

core 消费规则：

- 可以直接使用这份包组织当前执行
- 但不能覆盖显式 `currentObjective`
- `requestedAction` 只能当治理内的指导，不是漂移许可

## 2. `partial`

正式语义：

- 包已到达，但 producer 在关键字段里发现了 `missing`
- 这表示包不是彻底不可用，而是“部分可信、部分待核”

当前代码依据：

- 任一受检查字段为 `missing` 时，推断为 `partial`
- `confidenceLabel => medium`
- `freshness => aging`

core 消费规则：

- 可作为指导使用
- 依赖关键事实前要核对
- 与显式用户目标不完全一致时，以显式用户目标优先

## 3. `pending`

正式语义：

- 包处于准备中，尚未形成当前可权威消费的执行上下文

当前代码依据：

- 任一受检查字段为 `pending` 时，推断为 `pending`
- `confidenceLabel => low`
- `freshness => stale`

core 消费规则：

- 不把该包当权威上下文
- 继续依赖显式用户目标和已验证现场事实推进
- 不等待、不脑补 pending 包的未来内容

## 4. `skipped`

正式语义：

- 这轮 `CMP` 包被刻意跳过，或者当前模式下不应交付

当前代码依据：

- 任一受检查字段等于 `skipped`，或包含 `skipped in once mode` 时，推断为 `skipped`
- `confidenceLabel => low`
- `freshness => stale`

core 消费规则：

- 把 CMP 视为当前轮没有权威交接
- 继续依赖显式用户目标和现有证据
- 不把“跳过”误读成“历史包仍可直接继承”

## 5. `absent`

正式语义：

- 当前根本没有收到 `CmpTurnArtifacts`

当前代码依据：

- `createCmpContextPackage(undefined)` 返回 `deliveryStatus: absent`
- 同时给出最小降级 envelope：
  - `objective.taskSummary = no fresh CMP package is available yet for this turn`
  - `governance.operatorGuide = proceed with the direct user request and any already available capability window`

core 消费规则：

- 完全按显式用户目标和已验证现场事实工作
- 把 CMP 当未提供，而不是当隐形存在

## 五、当前 producer 的正式推断范围

当前 `deliveryStatus` 是从这些 `CmpTurnArtifacts` 字段综合推断的：

- `packageId`
- `packageRef`
- `projectionId`
- `snapshotId`
- `intent`
- `operatorGuide`
- `childGuide`
- `checkerReason`
- `routeRationale`
- `scopePolicy`
- `packageStrategy`
- `timelineStrategy`

正式含义：

- v1 当前的状态推断是“基于这组字段中的哨兵值”
- 这不是一个更复杂的多维健康评分器

因此本 contract 明确：

- 不要把 `deliveryStatus` 解释成对整份历史包的终局判定
- 也不要把它误解为未来版本已实现的更复杂 freshness engine

## 六、Core 端消费优先级

当前 core 端正式优先级如下：

1. 显式当前用户目标
2. 已验证的当前现场事实
3. `deliveryStatus` 决定后的 CMP guidance
4. 其余补充字段

这条优先级是由两部分共同保证的：

- `createLiveChatCoreContextualInput(...)` 会单独保留 `currentObjective = userMessage`
- `createCoreCmpHandoffLines(...)` 明确写死“不能让 CMP 覆盖显式当前目标”

## 七、Core 端正式消费规则

## 1. 永远先看显式 `currentObjective`

这条是根规则。

无论 `CMP` 包多完整，都不能把当前用户刚说的话盖掉。

## 2. `requestedAction` 只能被当作治理内建议

当前代码里已经明确：

- `requestedAction` 属于 governed guidance
- 它不是“允许漂移去做别的事”的许可证

## 3. `partial` 只能保守消费

当前 contract 要求：

- 可用，但只能作为指导
- 关键事实要核对
- 与当前用户目标不一致时不优先

## 4. `pending/skipped/absent` 都按“当前不可作权威上下文”处理

这三种状态虽然原因不同，但当前 core 消费纪律一致：

- 不拿来当 authoritative context
- 不等待
- 不脑补
- 继续从当前目标和证据推进

## 5. 缺字段不是自由脑补权限

如果 `payload` 某些可选字段缺失，当前 contract 要求：

- 只能理解为“当前 producer 没给”
- 不能自动推导为“没有风险/没有约束/没有额外上下文”

## 八、当前落地实现与 contract 对齐表

| contract 项 | 当前实现位置 | 当前状态 |
| --- | --- | --- |
| v1 顶层信封 | `src/agent_core/core-prompt/types.ts` | 已落地 |
| `deliveryStatus` 推断 | `src/agent_core/core-prompt/live-chat-contextual.ts` | 已落地 |
| `confidenceLabel/freshness` 派生 | `src/agent_core/core-prompt/live-chat-contextual.ts` | 已落地 |
| CMP 包渲染进 contextual user | `src/agent_core/core-prompt/contextual.ts` | 已落地 |
| core 端按状态分流消费纪律 | `src/agent_core/core-prompt/development.ts` | 已落地 |
| live 主链接入 | `src/agent_core/live-agent-chat.ts` | 已落地 |

## 九、当前 contract 明确不声称的内容

为了避免写成空中楼阁，这份文档明确不声称下面这些内容已经实现：

- `currentObjective` 已由 live producer 稳定产出
- `primaryContext/constraints/risks/sourceAnchorRefs` 已由 live producer 稳定产出
- 已存在更复杂的冲突合并器或 stale resolver
- 已存在独立的 CMP 重试 / 等待 / 续取协议

## 十、下一步最合理的补强方向

在不改动本次 contract 范围的前提下，后续最合理的补强是：

1. 给 `conflict/missing/stale` 补更明确测试，而不是先改大 schema。
2. 逐步把 `payload` 预留字段接上真实 producer。
3. 如果未来要提高状态机复杂度，应该新增文档版本或 contract 修订，而不是悄悄改写 v1 语义。

## 一句话收口

`core-cmp-context-package/v1` 当前不是“信息必须很全的完美包”，而是“哪怕包不全、没到、被跳过，core 也能稳定消费和稳定降级”的正式工作合同。
