# TAP First-Wave Capability Task Pack

状态：第一波 capability 接入并行编码任务包。

更新时间：2026-03-25

## 这包任务是干什么的

这一包不是继续扩写 `TAP` 的控制面设计稿。

这一包只做一件事：

- 把当前已经足够成熟、接进去就能用的一批 capability，正式接入 `TAP`

同时补齐 reviewer / `TMA` 的最小能力基线，让后面的 `CMP / MP` 多智能体工作流终于踩在真实能力库存上，而不是踩在 lane 语义上。

## 开工前必须先读

所有执行本包的 Codex 都必须先读：

- [01-basic-implementation.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/01-basic-implementation.md)
- [24-tap-mode-matrix-and-worker-contracts.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/24-tap-mode-matrix-and-worker-contracts.md)
- [25-tap-capability-package-template.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/25-tap-capability-package-template.md)
- [27-tap-runtime-completion-blueprint.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/27-tap-runtime-completion-blueprint.md)
- [28-tap-runtime-wave0-implementation-status.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/28-tap-runtime-wave0-implementation-status.md)
- [37-tap-first-wave-capability-intake-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/37-tap-first-wave-capability-intake-outline.md)
- [38-cmp-mp-ten-agent-minimum-capability-baseline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/38-cmp-mp-ten-agent-minimum-capability-baseline.md)
- [tap-runtime-completion-task-pack/11-first-class-tooling-baseline-for-reviewer-and-tma.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/tap-runtime-completion-task-pack/11-first-class-tooling-baseline-for-reviewer-and-tma.md)
- [docs/master.md](/home/proview/Desktop/Praxis_series/Praxis/docs/master.md)
- `memory/current-context.md`

## 本轮冻结共识

- 只专注 `TAP`
- 先不继续扩写 `CMP / MP` 本体
- 先接入已经成熟的 capability family：
  - `search.ground`
  - `skill.*`
  - `mcp.*`
- 同时补齐 reviewer / bootstrap `TMA` 最小内部基线：
  - `code.read`
  - `docs.read`
  - `repo.write`
  - `shell.restricted`
  - `test.run`
  - `skill.doc.generate`
- `dependency.install`
- `network.download`
- `mcp.configure`
  这三项属于第一波末段或下一波，不抢前面主链
- 不整条 cherry-pick 旧分支
- reviewer 继续只审不执行
- `TMA` 继续只造 capability，不替主 agent 完成原任务

## 推荐分波顺序

### Wave 0

- `00-wave0-scope-freeze-and-file-ownership.md`

### Wave 1

- `01-reviewer-readable-context-baseline.md`
- `02-code-read-capability-package.md`
- `03-docs-read-capability-package.md`
- `04-repo-write-capability-package.md`
- `05-shell-restricted-capability-package.md`
- `06-test-run-capability-package.md`
- `07-skill-doc-generate-capability-package.md`

### Wave 2

- `08-search-ground-provider-alignment.md`
- `09-search-ground-tap-package-and-runtime.md`
- `10-skill-reference-and-compose-contract.md`
- `11-skill-family-tap-package-and-runtime.md`
- `12-mcp-truthfulness-and-connection-safety.md`

### Wave 3

- `13-mcp-read-family-package.md`
- `14-mcp-call-and-native-execute-package.md`
- `15-first-wave-baseline-profile-and-registration-assembly.md`

### Wave 4

- `16-end-to-end-smoke-and-multi-agent-readiness.md`

## 推荐并发量

- Wave 0：`1`
- Wave 1：`7`
- Wave 2：`5`
- Wave 3：`3`
- Wave 4：`1`

如果机器性能充足，可以额外挂 explorer 做只读审查。

真正会写共享文件的 worker，同时改下面这些位置时要小心：

- `src/agent_core/runtime.ts`
- `src/agent_core/runtime.test.ts`
- `src/agent_core/capability-package/**`
- `src/rax/facade.ts`
- `src/rax/index.ts`

## 强依赖提醒

- `00` 没完成前，不要正式开写后续任务
- `01` 应先于 `15`
- `08` 应先于 `09`
- `10` 应先于 `11`
- `12` 应先于 `13/14`
- `15` 必须在 `16` 前完成

## 任务列表

- `00-wave0-scope-freeze-and-file-ownership.md`
- `01-reviewer-readable-context-baseline.md`
- `02-code-read-capability-package.md`
- `03-docs-read-capability-package.md`
- `04-repo-write-capability-package.md`
- `05-shell-restricted-capability-package.md`
- `06-test-run-capability-package.md`
- `07-skill-doc-generate-capability-package.md`
- `08-search-ground-provider-alignment.md`
- `09-search-ground-tap-package-and-runtime.md`
- `10-skill-reference-and-compose-contract.md`
- `11-skill-family-tap-package-and-runtime.md`
- `12-mcp-truthfulness-and-connection-safety.md`
- `13-mcp-read-family-package.md`
- `14-mcp-call-and-native-execute-package.md`
- `15-first-wave-baseline-profile-and-registration-assembly.md`
- `16-end-to-end-smoke-and-multi-agent-readiness.md`

## 一句话收口

这一包任务不是继续谈“未来能力应该长什么样”，而是把当前已经足够成熟的能力正式接进 `TAP`，让 reviewer、`TMA`、以及后面的 `CMP / MP` 多智能体终于有一套真实的最小能力地基。
