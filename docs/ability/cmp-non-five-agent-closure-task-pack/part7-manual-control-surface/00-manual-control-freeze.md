# Part 7 / 00 Manual Control Freeze

状态：冻结稿。

更新时间：2026-03-25

## 当前目标

把“默认自动可用 + 手动全过程可控”冻结成正式控制面方向。

## 已冻结前提

- `CMP` 既不是纯黑盒
- 也不是纯手动脚手架

## 当前明确要求

至少要能手动控制：

- active/passive/mixed
- lineage scope
- dispatch scope
- readback priority
- fallback policy
- rebuild policy
- auto-return
- auto-seed

## 当前不做

- 不在这一包里决定五个 agent 的最终默认配置
