# CMP Five-Agent Handoff Prompt

下面是一份给压缩上下文后的新会话直接使用的 handoff prompt。

你可以在压缩后把下面整段直接发给新的模型：

---

当前唯一目标是继续在 `/home/proview/Desktop/Praxis_series/Praxis` 的 `cmp/mp` 分支上推进 `CMP` 五个 agent 的下一阶段工作。

注意：

- 现在不是回去补 `CMP` 非五-agent 底座
- 也不是开始 `MP`
- 也不是继续泛泛盘问
- 当前阶段已经切到：
  - 五套角色配置
  - `TAP -> CMP` 基础能力接线
  - 受控联调准备

请先读取并对齐下面这些文件：

- [memory/current-context.md](/home/proview/Desktop/Praxis_series/Praxis/memory/current-context.md)
- [docs/ability/44-cmp-five-agent-implementation-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/44-cmp-five-agent-implementation-outline.md)
- [docs/ability/45-cmp-five-agent-configuration-and-controlled-reintegration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/45-cmp-five-agent-configuration-and-controlled-reintegration-outline.md)
- [docs/ability/cmp-five-agent-implementation-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-five-agent-implementation-task-pack/README.md)
- [docs/ability/cmp-five-agent-configuration-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-five-agent-configuration-task-pack/README.md)

当前已经确认的关键事实：

1. 五个 agent 的 runtime 首轮骨架已经真正进主链。
2. `core_agent -> rax.cmp -> cmp-runtime -> five-agent runtime` 已经能跑。
3. 已经通过：
   - `npm run typecheck`
   - `npm run build`
   - `npx tsx --test src/agent_core/cmp-five-agent/*.test.ts`
   - `npx tsx --test src/agent_core/runtime.test.ts src/rax/cmp-facade.test.ts src/rax/cmp-runtime.test.ts`
4. 五个 agent 名单固定为：
   - `ICMA`
   - `Iterator`
   - `Checker`
   - `DBAgent`
   - `Dispatcher`
5. 第一成功标准仍然是：
   - 主动主链稳定
6. `ICMA` 只能挂受控 fragment，不改根 `system prompt`。
7. 父 `DBAgent` 是主审和主出包者，但父 `Checker` 仍负责前置重整、证据辅助、历史检查和面向子任务的精裁建议。
8. 父节点默认先粗裁，子节点再由自己的 `Checker` 精裁。
9. 子 `CMP` 是独立主链，只继承父节点种子。
10. 子节点启动后允许中途再次向父节点受控申请补包。
11. 该再干预请求默认先打到父 `DBAgent`，并带：
   - 缺口说明
   - 当前状态
12. 同父平级交换不只在池内闭环批准，第一版应走：
   - 父 `DBAgent` 先处理
   - 父 `core_agent` 最终显式批准
13. 五套角色 prompt / profile / capability contract 必须明确分开。
14. `TAP` 第一优先先接：
   - git
   - db
   - mq
   基础能力，再补工具能力。
15. 下一波执行顺序固定为：
   - 先配置面
   - 再联调
16. 失败恢复策略现在按：
   - 同链路回卷恢复
17. 人工 override 第一版阈值很高，只用于极少数只读排障和异常控制。
18. 观测面第一优先看：
   - 每角色阶段
   - 包流向

当前代码相关状态补充：

- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.ts) 已经挂上五-agent runtime 元数据和 snapshot。
- [cmp-five-agent](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/cmp-five-agent/index.ts) 是当前五-agent 代码入口。
- [cmp-types.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-types.ts)、[cmp-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-runtime.ts)、[cmp-facade.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-facade.ts) 已经开始提供 five-agent summary 的只读可见性。

压缩后回来，直接做下面这些事：

1. 按 [45-cmp-five-agent-configuration-and-controlled-reintegration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/45-cmp-five-agent-configuration-and-controlled-reintegration-outline.md) 对齐目标
2. 按 [cmp-five-agent-configuration-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-five-agent-configuration-task-pack/README.md) 执行
3. 第一波先做五套角色配置
4. 第二波接 `TAP -> CMP` 的 `git/db/mq` 基础能力
5. 第三波做父子再干预、父主 agent 显式批准 peer exchange
6. 第四波做同链路回卷恢复和角色阶段/包流向观测

要求：

- 使用中文
- 不要跳回 `CMP` 非五-agent 公共底座
- 不要把 `TAP` 文档脏改动混进当前阶段的 `CMP` 主线判断里
- 继续保持五个角色的强隔离和未来可进程化边界
- 先配置，再联调

---
