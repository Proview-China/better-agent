# 00 Wave0 Scope Freeze And File Ownership

## 任务目标

冻结第一波 capability 接入的范围、顺序、共享写域和文件所有权，避免后面大并发 worker 互相打架。

## 必须完成

- 冻结第一波只接这三族外部能力：
  - `search.ground`
  - `skill.*`
  - `mcp.*`
- 冻结第一波只补这六项内部基线：
  - `code.read`
  - `docs.read`
  - `repo.write`
  - `shell.restricted`
  - `test.run`
  - `skill.doc.generate`
- 冻结高外部性能力暂缓：
  - `dependency.install`
  - `network.download`
  - `mcp.configure`
- 为每个后续任务分配推荐写域，明确哪些文件是高冲突区

## 允许修改范围

- `docs/ability/tap-first-wave-capability-task-pack/**`
- 必要时少量补 `docs/master.md`

## 不要做

- 不要直接改代码
- 不要提前接 capability
- 不要把 `CMP / MP` 的实现任务混进来

## 验收标准

- 后续 worker 拿到任务后知道自己能改哪些文件
- 高冲突文件被明确标记
- 第一波范围清楚，不再反复摇摆

## 交付说明

- 在最终说明里列出高冲突文件：
  - `src/agent_core/runtime.ts`
  - `src/agent_core/runtime.test.ts`
  - `src/agent_core/capability-package/**`
  - `src/rax/facade.ts`
  - `src/rax/index.ts`
