# Part 0 / 01 Write Domain Map

状态：主线程编排文档。

更新时间：2026-03-25

## 主线程独占写域

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/rax/cmp-facade.ts`
- `src/rax/cmp-runtime.ts`
- `docs/ability/cmp-non-five-agent-closure-task-pack/README.md`

## Part 1 默认写域

- `src/agent_core/cmp-runtime/infra-state.ts`
- `src/agent_core/cmp-runtime/runtime-snapshot.ts`
- `src/agent_core/cmp-runtime/runtime-recovery.ts`
- `src/rax/cmp-types.ts`
- `src/rax/cmp-facade.test.ts`

## Part 2 默认写域

- `src/rax/cmp-domain.ts`
- `src/agent_core/cmp-types/**`
- `src/agent_core/cmp-runtime/ingress-contract.ts`
- `src/agent_core/cmp-runtime/materialization.ts`
- `src/agent_core/cmp-runtime/section-*.ts`

## Part 3 默认写域

- `src/agent_core/cmp-git/**`
- `src/agent_core/cmp-runtime/git-lowering.ts`

## Part 4 默认写域

- `src/agent_core/cmp-db/**`
- `src/agent_core/cmp-runtime/db-lowering.ts`

## Part 5 默认写域

- `src/agent_core/cmp-mq/**`
- `src/agent_core/cmp-runtime/mq-lowering.ts`

## Part 6 默认写域

- `src/agent_core/cmp-runtime/recovery-reconciliation.ts`
- `src/agent_core/cmp-runtime/runtime-snapshot.ts`
- `src/agent_core/cmp-runtime/runtime-recovery.ts`

## Part 7 默认写域

- `src/rax/cmp-config.ts`
- `src/rax/cmp-types.ts`
- `src/rax/cmp-facade.test.ts`

## Part 8 默认写域

- `docs/ability/cmp-non-five-agent-closure-task-pack/part8-*/**`
- 低冲突 gate 文档与 matrix 文档

## sidecar 写域

- `*.test.ts`
- fixtures
- smoke docs
- acceptance matrix

sidecar 不负责业务主逻辑。
