# CMP Infra Closure Task Pack

状态：并行编码任务包。

更新时间：2026-03-24

## 这包任务是干什么的

这一包不是继续做 `CMP infra` 的第一波或第二波骨架，而是专门面向收尾阶段。

目标是把当前已经存在的：

- backend contract
- bootstrap skeleton
- runtime injection boundary
- in-memory executor sample

继续推进成：

- real backend execution
- runtime durable closure
- flow closure on real infra
- final preflight and observability gates

一句白话：

- 这不是“再补几个 helper”
- 这是 `CMP infra` 从可演示样板迈向可持续运行底座的最后一包

## 开工前必须先读

所有参与本包的 agent 都必须先读：

- [34-cmp-infra-real-backend-and-bootstrap-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/34-cmp-infra-real-backend-and-bootstrap-outline.md)
- [35-cmp-infra-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/35-cmp-infra-closure-outline.md)
- [cmp-infra-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-task-pack/README.md)
- [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)
- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- `memory/current-context.md`

## 本轮冻结共识

- `CMP` 继续使用：
  - `git`
  - `PostgreSQL`
  - `Redis`
- `CMP` 的 DB 继续按传统 DB 写，不按图里的 `DB(RAG)` 写。
- 当前阶段不做 `MP`。
- 当前阶段不把五个 agent 拆成五个独立服务。
- 所有收尾工作都必须最终服务于：
  - real backend execution
  - runtime closure
  - active/passive closure
  - preflight gate closure

## 四个部分

### Part 1

- 目录：
  - [part1-real-backend-executors-and-readback/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-closure-task-pack/part1-real-backend-executors-and-readback/README.md)
- 目标：
  - 把 git/pg/redis 从 contract/in-memory 推到 real executor 与 readback closure

### Part 2

- 目录：
  - [part2-runtime-bootstrap-checkpoint-and-recovery/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-closure-task-pack/part2-runtime-bootstrap-checkpoint-and-recovery/README.md)
- 目标：
  - 把 runtime bootstrap、checkpoint、recovery、hydration 和 durable state 收口

### Part 3

- 目录：
  - [part3-active-passive-flow-and-delivery-closure/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-closure-task-pack/part3-active-passive-flow-and-delivery-closure/README.md)
- 目标：
  - 把 active/passive flow、parent-child reseed、peer exchange、delivery path 在 real backend 上收口

### Part 4

- 目录：
  - [part4-preflight-observability-and-final-gates/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-closure-task-pack/part4-preflight-observability-and-final-gates/README.md)
- 目标：
  - 把 preflight、observability、smoke、multi-agent gate、五个 agent 接入前门控收口

## 全局串并行顺序

### Global Wave 0

- 主线程冻结本 README
- 4 个二层 agent 全部只读准备

### Global Wave 1

- Part 1:
  - `00`
- Part 2:
  - `00`
- Part 3:
  - `00`
- Part 4:
  - `00`

### Global Wave 2

- Part 1:
  - `01/02/03`
- Part 2:
  - `01/02`
- Part 3:
  - `01`
- Part 4:
  - `01`

### Global Wave 3

- Part 1:
  - `04/05/06`
- Part 2:
  - `03/04`
- Part 3:
  - `02/03/04`
- Part 4:
  - `02`

### Global Wave 4

- Part 1:
  - `07/08`
- Part 2:
  - `05/06`
- Part 3:
  - `05/06`
- Part 4:
  - `03/04`

### Global Wave 5

- Part 2:
  - `07/08`
- Part 3:
  - `07/08`
- Part 4:
  - `05/06`

### Global Wave 6

- Part 4:
  - `07/08/09`

## 强依赖提醒

- real executor 没稳前，不要把 recovery 结论写死。
- runtime recovery 没稳前，不要把 final gate 提前关闭。
- active/passive flow 在 real backend 上没跑通前，不要开始五个 agent preflight 收尾。
- observability 和 final gates 必须最后一波收。

## 推荐 agent 拓扑

### 主线程

- 数量：`1`
- 模型：`gpt-5.4-high`
- 责任：
  - 全局协议收口
  - 跨 Part 依赖仲裁
  - 最终联调与测试门控
  - 决定何时允许下一波并行展开

### 二层 agent

- 数量：`4`
- 默认模型：`gpt-5.4-high`
- ownership：
  - `Part1 Lead`
  - `Part2 Lead`
  - `Part3 Lead`
  - `Part4 Lead`

### 三层 agent

- 建议上限：`8-12`
- 默认模型：
  - 普通代码与 runtime 收尾：`gpt-5.4-high`
  - fixture/readback/doc/smoke：`gpt-5.4-medium`
  - recovery/consistency/interruption：`gpt-5.4-xhigh`

## 一句话收口

`CMP infra closure task pack` 处理的是最后一公里：让已经存在的 CMP infra 真正具备长期运行、恢复、回读和托底五个 agent 的能力。
