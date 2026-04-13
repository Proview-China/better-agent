# MP Native Memory Overlay Direction

状态：方向文档 / 未完成项对齐。

更新时间：2026-04-13

## 当前唯一目标

为 `/home/proview/Desktop/Praxis_series/Praxis/.parallel-worktrees/integrate-dev-master-cmp` 补一份 `MP-native memory overlay` 方向文档，明确当前 repo-memory producer 只是过渡层，后续要转向 `MP` 原生供给，但当前还没有完成这一步。

## 先说结论

当前 `memory overlay` 的现实状态是：

- 已有 repo-memory-backed minimal producer
- 已进入 core overlay index 主路径
- 但仍不是 `MP-native`

后续正确方向是：

- 保留 repo-memory 作为 bootstrap / fallback
- 让 `MP` 原生 memory surface 成为长期主入口

## 一、为什么要从 repo-memory 继续走向 MP-native

repo-memory 方案解决的是“先把 memory 做成目录卡”的问题。

它已经很好地解决了：

- 不再把大段 memory 正文常驻注入 prompt
- 可以按最小信号做 top-N 选择
- 可以给 core 一个稳定的 `memory index`

但它仍然有天然上限：

- 它读的是 repo 文档快照，不是 runtime 原生状态
- 它更擅长承载长期文档事实，不擅长承载当前 route、governance、topology
- 它很难单独回答“这次 turn 最该看的 memory package 到底是哪一份”

所以长期方向必须是 `MP-native`。

## 二、这里说的 MP-native 是什么

这里的 `MP-native` 不是“把 repo-memory producer 改个名字”。

它至少意味着：

1. memory 候选主要来自 `MP` runtime 自己维护的 memory surface
2. core 看到的 memory 结果是 `MP` 决定后的受治理材料，而不是 repo scan 的直接映射
3. ranking 依据要包含 objective、route、governance、freshness 等 runtime 信号
4. repo-memory 退到 fallback，而不是继续当默认主入口

一句白话：

- repo-memory 是“从仓库找文档卡片”
- MP-native 是“MP 根据当前任务主动给 core 发该看的 memory”

## 三、当前还没有完成的部分

截至 `2026-04-13`，下面这些都不应写成已完成：

- `MP-native memory producer`
- `MP-native overlay input contract`
- `MP` routed memory package 进入当前 core live path
- objective-aware / topology-aware 的正式 memory ranking

也就是说，这份文档是方向冻结，不是完成报告。

## 四、建议的演进顺序

### 第一步：先冻结输入合同

先定义未来 `MP-native` producer 至少应该能吃到什么输入，例如：

- 当前 objective
- 当前 route / mode
- freshness / confidence / governance 信号
- 可选的 repo-memory fallback snapshot

这一步的目的，是先把“MP-native 到底要接什么”说清楚。

### 第二步：保留 repo-memory fallback

在 `MP-native` 真正接通前，不要把 repo-memory 直接删掉。

更合理的定位是：

- 正常路径优先走 `MP-native`
- 缺失或降级时回退到 repo-memory bootstrap

### 第三步：单独补 ranking 测试

不要先把大改直接接进主链。

更稳的做法是先补独立测试，锁住：

- objective 优先级
- freshness 退化
- fallback 切换
- bodyRef/on-demand 行为

### 第四步：最后再接 live path

等输入合同和独立测试稳定后，再决定怎样把 `MP-native` producer 接回当前 live overlay path。

## 五、和当前实现的边界关系

当前实现不需要被否定，它是有效 bootstrap：

- `repo-memory-overlay-source.ts` 负责轻量 snapshot
- `memory-overlay-index-producer.ts` 负责最小排序
- `live-chat-overlays.ts` 负责把结果接进 live path

下一步不是推翻它们，而是重新定义层级：

- repo-memory：过渡层 / fallback
- MP-native：长期主入口
- overlay index：继续只承载摘要，不承载 raw 正文

## 六、独立测试建议

如果这轮只补文档、不碰主链代码，建议把测试 handoff 写成下面三类：

1. 已有事实测试
   - `repo-memory-overlay-source.test.ts`
   - `memory-overlay-index-producer.test.ts`
   - `live-chat-overlays.test.ts`
2. 下一步该补的独立测试
   - `MP-native input contract` fixture 测试
   - `fallback to repo-memory` 降级测试
   - `objective-aware ranking` 测试
3. 暂不承诺的测试
   - 不把“MP 已正式接 live path”的集成测试写成当前已存在

## 七、handoff 统一话术

建议后续统一使用下面这组表述：

- 当前已落地：`repo-memory-backed minimal producer`
- 当前定位：`bootstrap/fallback for memory overlay`
- 下一步方向：`MP-native memory overlay`
- 当前未完成：`MP-native producer and runtime integration`

这样写可以避免两种常见误导：

1. 把过渡层写成终态
2. 因为要强调未来方向，就否定当前最小 producer 已经落地的事实
