# Core Overlay Index Minimal Producer Design

状态：Task Pack G 设计读回 / 过渡实现边界说明。

更新时间：2026-04-13

## 当前唯一目标

把 `core-overlay-index/v1` 当前已经落地的最小 producer 写清楚，并明确 `repo-memory` 只是过渡实现；后续方向是 `MP-native`，但这一步还没有完成。

## 先说结论

当前 `overlay index` 已经有最小 producer，而且 `memory` 也已经进入 producer 阶段。

但要注意区分两件事：

1. “已经有 producer”
2. “已经进入 MP-native memory runtime”

现在只成立第 1 条，不成立第 2 条。

一句白话：

- 现在已经不是手写目录卡
- 但也还不是 MP 原生 memory surface

## 一、当前已经成立的事实

- `src/agent_core/core-prompt/types.ts`
  - 已定义 `core-overlay-index/v1`
- `src/agent_core/core-prompt/overlays.ts`
  - 已把 index 渲染成 `<core_overlay_index>`
- `src/agent_core/core-prompt/live-chat-overlays.ts`
  - 已在 live path 生产 `capabilityFamilies / skills / memories`
- `src/agent_core/integrations/repo-memory-overlay-source.ts`
  - 已从 repo `memory/` 扫出轻量 snapshot
- `src/agent_core/core-prompt/memory-overlay-index-producer.ts`
  - 已把 snapshot 变成 top-N memory index entries

这说明：

- `memory` 现在已经有统一入口
- assembler 不再临时手拼 memory 文案
- 当前缺的不是“有没有 producer”
- 当前缺的是“producer 的长期来源是不是已经转成 MP-native”

## 二、最小 producer 的真实边界

### 2.1 当前 producer 真正在做什么

当前 `memory producer` 只做三件事：

1. 从 repo-memory snapshot 里选候选
2. 压成短摘要
3. 给出可选 `bodyRef`

当前主输入信号仍是：

- 用户消息 token
- memory 分类优先级
- 更新时间

### 2.2 当前 producer 明确还没做什么

当前还没有正式做到：

- 由 `MP` runtime 直接产出 routed memory package
- 使用 topology-aware 的 memory routing
- 使用 objective-aware 的正式 ranking contract
- 把 runtime governance state 作为 memory producer 的主输入

所以这里的正确说法应是：

- `repo-memory-backed minimal producer`

而不是：

- `MP-native memory producer`

## 三、为什么 repo-memory producer 仍有价值

它的价值在于先把以下链路打通：

1. `memory/` -> snapshot
2. snapshot -> index entries
3. index entries -> overlay index
4. overlay index -> core contextual input

这条链路现在已经把 “memory 正文常驻” 改成了 “memory 目录卡常驻”。

这是对的，因为：

- prompt 预算更稳
- consumer 边界更清楚
- 后续可以在 producer 内升级来源和排序，而不必回退到原始长文注入

## 四、为什么它仍然只是过渡层

因为当前 memory 的主来源仍然是 repo 内可扫描文档，而不是 `MP` 原生运行面。

过渡层的典型特征是：

- 候选集来自 repo `memory/`
- `current-context` 这类长期 authoritative 文档会稳定置顶
- `decision / worklog` 主要靠 query 命中和更新时间竞争位置
- `bodyRef` 指向的仍是 repo 文档体，而不是 MP runtime materialization

一句白话：

- 它更像“从仓库里挑卡片”
- 还不是“MP 自己给 core 派发 memory 包”

## 五、MP-native 的目标口径

后续 `MP-native` 应该至少满足下面几件事，才算真正从过渡层升级出去：

1. 候选来源以 `MP` runtime 的 memory surface 为主，而不是 repo scan 为主
2. 排序依据以当前 objective、route、governance、freshness 为主，而不只是 token/category
3. memory 结果以受治理的 package 或 overlay material 进入 core，而不是把 repo doc 当默认主入口
4. repo-memory producer 退为 bootstrap / fallback，而不是默认长期路径

在这几项没完成前，文档都应该写成：

- 方向已明确
- 实现未完成
- 当前仍处于 repo-memory 过渡期

## 六、当前建议的责任分层

### 层 1：repo-memory bootstrap

职责：

- 从 repo `memory/` 读轻量 snapshot
- 作为过渡期和 fallback 候选来源

### 层 2：memory overlay producer

职责：

- 根据当前输入选择 top-N entries
- 只输出 `id / label / summary / bodyRef`

### 层 3：future MP-native producer

职责：

- 用 `MP` 原生输入替代 repo scan 的主地位
- 让 routed memory/context material 成为长期正式来源

## 七、独立测试口径

当前已存在、且适合作为 handoff 证据的独立测试有：

- `src/agent_core/integrations/repo-memory-overlay-source.test.ts`
- `src/agent_core/core-prompt/memory-overlay-index-producer.test.ts`
- `src/agent_core/core-prompt/live-chat-overlays.test.ts`

这些测试当前证明的是：

- repo-memory bootstrap 存在
- minimal producer 存在
- live path 已接入 overlay index

这些测试当前没有证明的是：

- `MP-native` 已完成

如果后续要补测试，建议先补独立测试说明，而不是急着改主链：

1. `MP-native input contract` 的 fixture 级测试
2. `repo-memory fallback` 仍可用的降级测试
3. `objective-aware ranking` 的独立排序测试

## 八、handoff 写法约束

后续接棒时，统一使用下面口径：

- 当前：`repo-memory-backed minimal producer`
- 下一步：`MP-native memory overlay direction`
- 未完成：`MP-native producer/runtime path`

不要写成：

- memory overlay 已 native 化
- repo-memory 只是历史遗留且已退出主路径
- MP 已经在当前 live path 正式供给 memory package
