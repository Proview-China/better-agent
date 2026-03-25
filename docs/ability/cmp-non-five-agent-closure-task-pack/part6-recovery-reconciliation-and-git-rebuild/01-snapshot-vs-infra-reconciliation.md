# Part 6 / 01 Snapshot Vs Infra Reconciliation

状态：Part6 子任务说明。

更新时间：2026-03-25

## 这一小块要解决什么

当前 recovery 最大的问题不是“能不能恢复”，而是：

- 恢复前不知道 snapshot 和 infra 到底有没有对上

所以这一小块先收成一个正式 helper：

- 输入：
  - `CmpRuntimeSnapshot`
  - `CmpRuntimeInfraProjectState[]`
- 输出：
  - 每个 project 的 reconciliation record

## 当前希望最少看见的对账面

- `snapshotProjectPresent`
- `infraProjectPresent`
- `snapshotRepoPresent`
- `branchRuntimeAgentIds`
- `mqBootstrapAgentIds`
- `snapshotLineageAgentIds`
- `infraLineageAgentIds`
- `issues`
- `recommendedAction`

## 当前已经明确的残留缺口

这块做完以后，仍然还有这些恢复缺口没有收：

1. 还没有真正把 reconciliation 结果喂回 `runtime.ts`
2. 还没有完成 DB projection/package 缺失时的 git rebuild 主链
3. 还没有定义冲突时谁最终拍板
4. 还没有把 delivery loss / ack drift 纳入恢复主链

## 当前建议

主线程后续接这层时，应优先做：

1. `hydrateCmpRuntimeSnapshotWithReconciliation(...)`
2. 主线程 readback / smoke summary 吃 reconciliation
3. 再进入 DB-missing -> git rebuild
