# Part 1 Core Object Model And Section Lifecycle

## 目标

把 `request / section / package / snapshot` 四类对象彻底落成正式模型。

## 子任务

1. `Request` 对象
- 明确字段与状态机
- `received -> reviewed -> accepted/denied -> served`

2. `Section` 生命周期
- 明确：
  - `raw`
  - `pre`
  - `checked`
  - `persisted`
- 明确：
  - 来源锚点
  - 版本链
  - merge/split ancestry
  - 目录落盘规则

3. `Snapshot` 对象
- 明确它是阶段快照

4. `Package` 对象
- 明确它由 persisted section 派生
- 明确版本化策略

## 联调要求

- 对象之间必须能建立明确引用链：
  - `request -> section -> snapshot -> package`
- recovery 至少要能把这条链找回
