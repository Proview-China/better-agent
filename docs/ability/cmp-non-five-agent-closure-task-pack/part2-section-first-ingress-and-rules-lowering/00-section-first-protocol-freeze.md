# Part 2 / 00 Section-First Protocol Freeze

状态：冻结稿。

更新时间：2026-03-25

## 当前目标

把 `Section-first` lowering 方案冻结下来。

## 已冻结前提

- 所有 ingest materials 先进入 `Section`
- `Section` 默认是 exact fidelity 入口
- 再按 `Rules` 进入 `StoredSection`
- 后续 checked / projection / package / dispatch 都应该能引用这层对象

## 当前明确要求

- 不允许只在 checked 之后才开始做 section 映射
- `Section` 必须能表达：
  - lineage path
  - tags
  - source
  - fidelity
  - payload refs

## 当前不做

- 不在这一包里做五个 agent prompt/config
- 不直接改 `runtime.ts`
