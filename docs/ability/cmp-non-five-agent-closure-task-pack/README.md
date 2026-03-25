# CMP Non-Five-Agent Closure Task Pack

状态：并行编码任务包。

更新时间：2026-03-25

## 这包任务是干什么的

这包任务专门处理：

- `CMP` 里和五个 agent 配置/职责无关
- 但在进入五个 agent 之前必须收完

的那一整轮 closure 工作。

它不是：

- 五个 agent 的 prompt/config/职责细调包
- `MP` 实现包
- 强绑定 `CMP <-> TAP` 的桥接包

一句白话：

- 这包任务处理的是“先把 CMP 自己做完整”

## 开工前必须先读

所有参与本包的 agent 都必须先读：

- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- [29-cmp-context-management-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/29-cmp-context-management-pool-outline.md)
- [30-cmp-core-interface-and-canonical-object-model.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/30-cmp-core-interface-and-canonical-object-model.md)
- [31-cmp-git-lineage-repo-and-sync-governance.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md)
- [32-cmp-db-projection-and-neighborhood-broadcast-contract.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md)
- [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)
- [39-cmp-runtime-live-integration-and-tap-bridge-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/39-cmp-runtime-live-integration-and-tap-bridge-outline.md)
- [40-cmp-non-five-agent-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/40-cmp-non-five-agent-closure-outline.md)
- `memory/current-context.md`

## 本轮冻结共识

- 先只做 `CMP` 非五-agent部分。
- 优先收 `infra truth`，不是优先做五个 agent。
- 真相源按对象分层：
  - `git`：历史 / checked / promoted
  - `DB`：projection / package
  - `Redis`：dispatch / ack / expiry
- `requestHistory` 在 projection 缺失时允许从 `git` 重建。
- `Section / StoredSection / Rules` 采用 section-first lowering。
- git workflow 这一轮尽量做真，但先立足本地 git 近似真实工作流。
- `CMP` 要默认自动可用，同时允许手动全过程控制。
- `TAP` 这轮只留桥位，不强绑定。

## 主线程编排层

这轮除了 8 个 Part，还应显式保留一个：

- `Program Control Layer`

它不作为普通 Part 分给 worker，而是由主线程独占。

职责：

- 冻结协议
- 决定每一波放行
- 处理高冲突文件
- 统一把 helper 接回主链
- 负责最终联调、验收、wrap-up

主线程单写文件默认包括：

- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.ts)
- [runtime.test.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.test.ts)
- [cmp-facade.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-facade.ts)
- [cmp-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-runtime.ts)
- 总包 `README`

## 八个部分

### Part 1

- 目录：
  - [part1-truth-model-and-readback-closure/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part1-truth-model-and-readback-closure/README.md)
- 目标：
  - 把 `git / DB / Redis` 的真相分层和 readback 合同收成统一口径

### Part 2

- 目录：
  - [part2-section-first-ingress-and-rules-lowering/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part2-section-first-ingress-and-rules-lowering/README.md)
- 目标：
  - 让所有 ingest materials 先进入 `Section`，再按 `Rules` 进入后续主链

### Part 3

- 目录：
  - [part3-local-git-workflow-realism/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part3-local-git-workflow-realism/README.md)
- 目标：
  - 把本地 git 的 commit / checked / promoted / merge / repair 做得更像真人工作流

### Part 4

- 目录：
  - [part4-db-projection-and-package-truth/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part4-db-projection-and-package-truth/README.md)
- 目标：
  - 把 projection / package 收成真正以 `DB` 为真

### Part 5

- 目录：
  - [part5-mq-delivery-and-ack-truth/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part5-mq-delivery-and-ack-truth/README.md)
- 目标：
  - 把 dispatch / ack / expiry 收成真正以 `Redis` 为真

### Part 6

- 目录：
  - [part6-recovery-reconciliation-and-git-rebuild/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part6-recovery-reconciliation-and-git-rebuild/README.md)
- 目标：
  - 把 recovery、reconciliation、git rebuild 这一层收齐

### Part 7

- 目录：
  - [part7-manual-control-surface/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part7-manual-control-surface/README.md)
- 目标：
  - 把“默认自动可用 + 手动全过程可控”做成正式控制面

### Part 8

- 目录：
  - [part8-final-non-five-agent-gates/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part8-final-non-five-agent-gates/README.md)
- 目标：
  - 收 `CMP` 自己的 final non-five-agent acceptance gates

## 全局串并行顺序

### Global Wave 0

- 主线程冻结本 README
- 8 个二层 lead 全部只读准备
- verification / readback sidecar worker 只收入口，不开写

### Global Wave 1

- Part 1:
  - `00`
- Part 2:
  - `00`
- Part 3:
  - `00`
- Part 4:
  - `00`
- Part 5:
  - `00`
- Part 6:
  - `00`
- Part 7:
  - `00`
- Part 8:
  - `00`

### Global Wave 2

- Part 1:
  - `01/02`
- Part 2:
  - `01/02`
- Part 3:
  - `01`
- Part 4:
  - `01`
- Part 5:
  - `01`
- Part 6:
  - `01`
- Part 7:
  - `01`
- Part 8:
  - `01`

### Global Wave 3

- Part 1:
  - `03/04`
- Part 2:
  - `03/04`
- Part 3:
  - `02/03`
- Part 4:
  - `02/03`
- Part 5:
  - `02/03`
- Part 6:
  - `02`
- Part 7:
  - `02/03`
- Part 8:
  - `02`

### Global Wave 4

- Part 3:
  - `04/05`
- Part 4:
  - `04/05`
- Part 5:
  - `04/05`
- Part 6:
  - `03/04`
- Part 7:
  - `04/05`
- Part 8:
  - `03/04`

### Global Wave 5

- Part 1:
  - `05`
- Part 2:
  - `05`
- Part 3:
  - `06`
- Part 4:
  - `06`
- Part 5:
  - `06`
- Part 6:
  - `05/06`
- Part 7:
  - `06`
- Part 8:
  - `05`

### Global Wave 6

- Part 8:
  - `06/07/08`

## 推荐 agent 拓扑

### 主线程

- 数量：`1`
- 模型：`gpt-5.4-high`
- 责任：
  - 守住高冲突文件
  - 仲裁 truth model / runtime / control plane 依赖
  - 决定每一波放行
  - 负责最终联调、测试、验收

### 二层 leads

- 数量：`8`
- 默认模型：`gpt-5.4-high`
- ownership：
  - `Part1 Lead`
  - `Part2 Lead`
  - `Part3 Lead`
  - `Part4 Lead`
  - `Part5 Lead`
  - `Part6 Lead`
  - `Part7 Lead`
  - `Part8 Lead`

### 三层 workers

- 建议数量：`16-24`
- 默认模型：
  - 正常代码实现 / 契约 / 测试：`gpt-5.4-high`
  - fixture / smoke / 文档 / readback：`gpt-5.4-medium`
  - recovery / reconciliation / 高耦合 truth logic：`gpt-5.4-xhigh`

### sidecar workers

- `Verification Worker`
  - 不负责业务主实现
  - 只负责：
    - tests
    - fixtures
    - smoke
    - readback evidence
- `Conflict Sentinel`
  - 不写业务逻辑
  - 只盯：
    - 高冲突文件
    - 波次越界
    - 写域重叠

一句白话：

- 实现 worker 造零件
- verification worker 做证据
- 主线程接总线

## 强依赖提醒

- 所有会碰 `src/agent_core/runtime.ts` 的改动，默认由主线程或单写者收口。
- `Section-first` 没稳前，不要锁死后续 `DB` 和 `requestHistory` 结论。
- `git` workflow realism 没稳前，不要宣称 `CMP` 历史主干已收完。
- `Redis` delivery truth 没稳前，不要宣称 dispatch/ack 已最终可回读。
- `manual control surface` 没稳前，不要宣称 `CMP` 已经适合进入五个 agent 阶段。
- `Part8` 必须最后收。
- 不要让同一个 worker 同时负责“写逻辑 + 宣告这一层已经验收完成”。

## 一句话收口

这包任务不是在继续补边角，而是在把 `CMP` 自己收成一个真正独立、可治理、可回读、可恢复、可控的系统。
