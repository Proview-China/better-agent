# Core CMP BFG Implementation Status And Handoff

状态：实现读回文档 / 供后续任务接棒。

更新时间：2026-04-13

## 当前唯一目标

把 `Task Pack B / F / G` 这轮已经真实落地到代码和测试的内容整理成 handoff，尤其把 `G` 的 memory 口径说清楚：当前先用 repo-memory producer 打通 overlay index，但这不是 memory 终态，后续方向仍是 `MP-native`。

## 先说结论

`B / F / G` 当前成熟度不同：

1. `B` 已经进入主链共享 helper，属于“已落地 + 已定向验证”
2. `F` 已有正式 handoff contract，属于“已落地 + contract 已冻结”
3. `G` 已把 `overlay index + minimal producers` 接进 live path，但 `memory` 仍是过渡实现，不应写成 `MP-native` 已完成

一句白话：

- 现在 core 已经能吃到 `memory index`
- 但这批 `memory index` 还主要来自 repo 内 `memory/` 的轻量 snapshot
- 真正长期方向仍然是让 `MP` 自己产出更原生的 memory surface，而不是长期停在 repo 扫描模式

## 一、统一验证结论

当前能直接支撑这轮 handoff 的，是定向测试而不是全仓绿灯：

- `src/agent_core/core-prompt/live-chat-contextual.test.ts`
- `src/agent_core/core-prompt/live-chat-overlays.test.ts`
- `src/agent_core/core-prompt/overlays.index.test.ts`
- `src/agent_core/core-prompt/memory-overlay-index-producer.test.ts`
- `src/agent_core/integrations/repo-memory-overlay-source.test.ts`

这轮 handoff 的验收口径应保持为：

- 目标测试能证明 `B / F / G` 当前事实
- 不把“全仓 build / typecheck 已完全收口”写成已完成事实

## 二、Task Pack B

### 当前状态

状态：已落地 / 已定向验证 / 仍可继续补厚

### 已落地实现

- `src/agent_core/core-prompt/development.ts`
  - 已提供 `core-development/v1` pack
  - 已承载 objective anchoring、validation、continuation discipline 等共享 helper
- `src/agent_core/live-agent-chat.ts`
  - `user-input` 与 `action-planner` 已共用上述 helper

### 当前仍缺的口

- `taskStatus` 的完整制度语义还没单独冻结
- continuation / resume 的独立验收面还不完整
- 更广义 runtime 还没全部接入这套 discipline

### 给下一位 agent 的直接动作

- 先补 `taskStatus` 语义冻结
- 再补 continuation / resume 定向测试与文档

## 三、Task Pack F

### 当前状态

状态：已落地主路径 / 已桥接验证 / contract 已冻结

### 已落地实现

- `src/agent_core/core-prompt/types.ts`
  - 已定义 `core-cmp-context-package/v1`
- `src/agent_core/core-prompt/live-chat-contextual.ts`
  - 已把 `CmpTurnArtifacts` 映射成结构化 `cmpContextPackage`
  - 已支持 `available / partial / pending / skipped / absent`
- `src/agent_core/core-prompt/contextual.ts`
  - 已把 `cmpContextPackage` 渲染进结构化块
- `src/agent_core/core-prompt/development.ts`
  - 已按 `deliveryStatus` 给出 core 端 handoff discipline
- `src/agent_core/core-prompt/live-chat-assembly.ts`
  - 已把 `system / development / overlay / contextual / mode / contract` 做分层组装

### 本轮冻结文档

- [76-core-cmp-prompt-engineering-direction.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/76-core-cmp-prompt-engineering-direction.md:1)
- [80-core-cmp-handoff-contract-v1.md](/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp/docs/ability/80-core-cmp-handoff-contract-v1.md:1)

### 当前仍缺的口

- `conflict / missing / stale` 还缺更细的单测覆盖
- `payload` 里的多数字段仍是 schema 预留位
- 不应把更复杂的冲突解析和重试协议提前写成 v1 已完成

## 四、Task Pack G

### 当前状态

状态：overlay index 已接入 live path；`capability / skill / memory` 三组最小 producer 已落地；其中 `repo-memory` producer 只是过渡层，不是 memory 终态

### 已落地实现

- `src/agent_core/core-prompt/overlays.ts`
  - overlay index 已支持 `capabilityFamilies / skills / memories`
- `src/agent_core/core-prompt/live-chat-overlays.ts`
  - 已在 live path 同时生产三组 index
- `src/agent_core/core-prompt/memory-overlay-index-producer.ts`
  - 已把 repo memory snapshot 排成 `memory index entries`
- `src/agent_core/integrations/repo-memory-overlay-source.ts`
  - 已从 repo `memory/` 目录读取轻量 snapshot

### 这里必须写清的当前事实

当前 `memory` 这条线已经不是“手写几段静态文案塞进 prompt”。

现在真实成立的是：

1. 先由 `repo-memory-overlay-source` 从 repo `memory/` 读取轻量 snapshot
2. 再由 `memory-overlay-index-producer` 按用户消息、分类优先级、更新时间做最小排序
3. 最后只把 top-N `memory index entries` 放进 `overlay index`

所以它已经是 producer，但只是最小 producer。

### 这里同样必须写清的未完成事实

当前这版 `memory producer` 不应被表述成：

- `MP-native memory overlay` 已完成
- memory 已经脱离 repo snapshot
- memory 已经具备 objective-aware、topology-aware、runtime-native 的正式供给路径

这些都还没有完成。

### 为什么说它只是过渡层

因为当前候选集和信号仍然明显偏 repo 侧：

- 候选主要来自 repo `memory/`
- 排序仍以 query token、分类优先级、更新时间为主
- 还没有把 `MP` 自己的 routed package、governed runtime state、future topology support 变成正式输入

一句白话：

- 现在像是“先把仓库里的 memory 卡片做成目录”
- 还不是“让 MP 作为 memory runtime 原生给 core 发包”

### 下一阶段的正确方向

下一阶段应写成 `MP-native direction`，而不是写成“当前已经完成”：

1. `memory` 候选来源从 repo snapshot 逐步迁到 `MP` 原生可治理输入
2. `memory` 排序从 token/category/freshness 最小打分，升级到 objective-aware 的 ranking
3. `bodyRef` 继续保留为 on-demand 展开锚点，而不是回退到 raw 正文常驻
4. repo-memory producer 在过渡期继续存在，但定位是 bootstrap 和 fallback，不是长期主入口

### 已能支撑 handoff 的独立测试事实

- `src/agent_core/integrations/repo-memory-overlay-source.test.ts`
  - 锁住 repo `memory/` -> snapshot 的轻量读取行为
- `src/agent_core/core-prompt/memory-overlay-index-producer.test.ts`
  - 锁住最小排序与 `current-context` 优先级
- `src/agent_core/core-prompt/live-chat-overlays.test.ts`
  - 锁住 live path 能稳定产出 memory 组

这些测试能证明：

- 过渡 producer 已经存在
- 但测试对象仍是 repo-memory 路径，不是 `MP-native` runtime

### 给下一位 agent 的直接动作

- 先把 `MP-native` 方向单独成文，冻结“终态不是 repo scan”的口径
- 再决定 `MP` 原生输入 contract 和 overlay consumer 如何对接
- 如需补测试，优先补独立测试，不要直接把未完成方向硬接进主链

## 五、handoff 禁止误写项

接下来补文档或继续实现时，不要把下面这些话写成事实：

- `MP-native memory overlay` 已完成
- repo-memory producer 已退场
- memory 已经完全脱离 repo `memory/`
- deep overlay / routed memory package 已进入当前 live path

正确口径应该是：

- 当前已落地的是 repo-memory-backed minimal producer
- 下一步方向是 `MP-native`
- repo-memory producer 是过渡层和 fallback，不是长期终态
