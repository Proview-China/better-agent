# 07 Git Sync Runtime Orchestrator

## 任务目标

把 iterator/checker 需要的 git runtime orchestration 接成第一版。

## 必须完成

- commit -> PR -> merge -> promotion 顺序
- ref 更新顺序
- iterator/checker 的 orchestration 接点

## ownership

- 二层：`Runtime Orchestrator Worker`
- 模型：`gpt-5.4-high`

## 依赖前置

- `04`
- `06`

## 最小验证义务

- orchestrator 能按顺序推进 commit -> PR -> merge -> promotion

