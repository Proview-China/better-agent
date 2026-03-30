# Modern Infrastructure of the Agents Systems

## Wills

- 因为发现当下的ai-infra for vibe-coding工具(如gemini-cli,codex-cli,claude code)等工具存在巨大的former缺陷,当时因为llm能力不足,就急于开发各种llm-based coding toolchains,导致当下出现claude-opus-4.6,gemini-pro-3.1,gpt-5.3-codex这三款优秀的llm时,llm通常被困住手脚,导致并不能非常好(尤其是高效)的完成特定的agent任务,especially focused on coding,故有对coding-cli/toolchains etc. infras 的destruct的demand.
- 所以综合考量当下市场的情况,从cursor,claude code(tui/gui)到开源的gemini-cli,codex-cli,以及opencode等ai coding 工具和infra工具,有大一统的需求,需要有一个基准底座,不仅要跟上时代的节奏(如skills),还需要承载最基本的功能,完成agent的构建范式,并覆写langchain这类过时infra.
- 最后,致力于不断探索agent边界与扩展其能力范围,以追求更高效更精准的agent实现,我提出下面的洞察与观点.此项目仅为让agent发展提速,并且致力于不断迭代使得ai有更好的工作机制与效率,希望其可以成为ai-infra基石中的基石.

## Ability

- 预想中,ai处理任务的机制目前还是使用代码.包括进openclaw的亮眼部分,也不过是连接件和中间件,在agent本质上的探索是很古板和老套的.
- 为了处理更多的任务,llm学习到非常多的中间件,并对其进行固定化CoT的实现(也就是套模板).
- 比如为了实现doc文档的编辑,agent需要使用开源的/免费的工具docman,从固定范式出发,发现是"处理文档"的需求,到映射到开源doc处理工具,再到查看docman的文档和探索该工具使用方法,从而编写代码使用该工具,最后运行代码借助中间件完成工作.
- 无论是chrome-devtools-mcp/playwright的浏览器自动化处理,还是adb操控安卓手机完成自动流程,本质上agent使用同一种方案来进行tool_use完成特定任务.所以anthropic联想到使用固定的函数化处理同类工作,并通过mcp作为mssa中间件,并使用skills包装完成打包,从而让ai了解到tools的使用.
- 所以agent的核心重点是使用tools来完成特定任务.llm的能力仅体现在如何生成高质量的工具调用方法,现代agent已经有长足的tool_use策略来完善各类的方案.而llm受限于上下文窗口的长度限制,以及agent并发能力,对工具的使用能力边界被极大控制.
- 于是从llm诞生之初,流行的64/128/200K的上下文窗口等,为了无限拓展其记忆能力,出现memory工具链来完善这一过程.
- 但是memory_system的局限在,每次都需要有大量的记忆上下文交给llm来处理,这本质上限制了agent对应有的上下文的处理能力.
- 所以拆解上下文,包装工具成为特定skill包,并反复调用对应的skill并对应正确的上下文隔离,成为multi-agent的核心评判标准.
- 在2024年,anthropic发布的"上下文工程"一文中,提到上下文隔离的重要性,这是超前的,但是并没有意识到后续工具才是其核心.anthropic只预料到了在合适范围的上下文中产生特定的prompt注入的重要性,但忽略了prompt本身的价值.prompt作为system_prompt注入到自身中时,已经产生固定成本,并已经对agent的能力划分出了边界.这一点才是multi-agent和树状/网状agents结构的核心要点.

**针对上述讨论,故有下面的工具划分.**

### 一, 基本实现

- 基本工具模块
- 记忆模块
- connectors,app_gateways

### 二, 包装机架构(工具组/上下文组)

- 工具包装机
- 知识包装机
- 预制包装机
- 包装机注入
- 包装机迭代
- 包装机的转移与分发
- 包装机抽象与实例化

### 三, 上下文管理器(行为管理/实例控制)

- 抽离/剥夺
- 隔离
- 覆盖/更新
- 接续
- 迭代

### 四, 拓扑结构组装器

- 线性
- 广度优先
- 深度优先
- 环式
- 隔离式
- 网式
- 群岛

### 五, I/O抽象化

- 同步能力
- 异步能力

### 六, OOA方法

- 继承/多态/抽象
- 拓扑结构层级
- Agents层级抽象化
- 静态Multi-Agents
- 动态Multi-Agents
- 拓扑定义与管理

### 七, 云接口库与实例库

- 公用接口
- 实例调用
- 依赖管理
- CI/CD实现

### 八, 部署,配置,与自主边界探索

- 部署方法
- 自动化配置
- 环境边界认知
- 自主外部调用
- 意图判断与实现

## 预算与token控制

## 模型选择

## 基座作用与意义


针对消息队列的设计,自然可以想到群聊方法和@agent和文件的方法.

## Current Execution Roadmaps

- MCP 官方对齐与分阶段执行路线图：
  - [13-mcp-official-alignment-roadmap.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/13-mcp-official-alignment-roadmap.md)
- Agent Core raw runtime kernel 总纲：
  - [16-agent-core-runtime-kernel-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/16-agent-core-runtime-kernel-outline.md)
- Agent Core 能力接口与执行池总纲：
  - [17-agent-capability-interface-and-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/17-agent-capability-interface-and-pool-outline.md)
- Agent Core 能力接口并行编码任务包：
  - [agent-capability-interface-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/agent-capability-interface-task-pack/README.md)
- T/A Pool 控制平面总纲：
  - [20-ta-pool-control-plane-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/20-ta-pool-control-plane-outline.md)
- T/A Pool 阶段实现状态：
  - [21-ta-pool-implementation-status.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/21-ta-pool-implementation-status.md)
- T/A Pool 上下文压缩交接：
  - [22-ta-pool-handoff-prompt.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/22-ta-pool-handoff-prompt.md)
- T/A Pool 阶段性收尾：
  - [23-ta-pool-stage-wrap-up.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/23-ta-pool-stage-wrap-up.md)
- TAP 模式矩阵与 worker 协议冻结稿：
  - [24-tap-mode-matrix-and-worker-contracts.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/24-tap-mode-matrix-and-worker-contracts.md)
- TAP capability package 模板冻结稿：
  - [25-tap-capability-package-template.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/25-tap-capability-package-template.md)
- TAP runtime 迁移与 enforcement 总纲：
  - [26-tap-runtime-migration-and-enforcement-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/26-tap-runtime-migration-and-enforcement-outline.md)
- TAP runtime 补全蓝图：
  - [27-tap-runtime-completion-blueprint.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/27-tap-runtime-completion-blueprint.md)
- TAP runtime 第三阶段第一波实现状态：
  - [28-tap-runtime-wave0-implementation-status.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/28-tap-runtime-wave0-implementation-status.md)
- TAP runtime 补全并行编码任务包：
  - [tap-runtime-completion-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/tap-runtime-completion-task-pack/README.md)
- CMP 总纲：
  - [29-cmp-context-management-pool-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/29-cmp-context-management-pool-outline.md)
- CMP Part 1: core interface 与 canonical object model：
  - [30-cmp-core-interface-and-canonical-object-model.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/30-cmp-core-interface-and-canonical-object-model.md)
- CMP Part 2: git lineage repo 与同步治理：
  - [31-cmp-git-lineage-repo-and-sync-governance.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/31-cmp-git-lineage-repo-and-sync-governance.md)
- CMP Part 3: DB projection 与邻接广播契约：
  - [32-cmp-db-projection-and-neighborhood-broadcast-contract.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/32-cmp-db-projection-and-neighborhood-broadcast-contract.md)
- CMP Part 4: 五 agent 运行拓扑与主动/被动模式：
  - [33-cmp-five-agent-runtime-and-active-passive-flow.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/33-cmp-five-agent-runtime-and-active-passive-flow.md)
- CMP infra 真实 backend 与 bootstrap 总纲：
  - [34-cmp-infra-real-backend-and-bootstrap-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/34-cmp-infra-real-backend-and-bootstrap-outline.md)
- CMP infra 收尾总纲：
  - [35-cmp-infra-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/35-cmp-infra-closure-outline.md)
- RAX CMP 工作流接入总纲：
  - [36-rax-cmp-workflow-integration-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/36-rax-cmp-workflow-integration-outline.md)
- TAP 第一波 capability 接入总纲：
  - [37-tap-first-wave-capability-intake-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/37-tap-first-wave-capability-intake-outline.md)
- CMP/MP 十 agent 最小能力基线：
  - [38-cmp-mp-ten-agent-minimum-capability-baseline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/38-cmp-mp-ten-agent-minimum-capability-baseline.md)
- CMP runtime 正式接入与 TAP 最小接缝总纲：
  - [39-cmp-runtime-live-integration-and-tap-bridge-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/39-cmp-runtime-live-integration-and-tap-bridge-outline.md)
- CMP 非五-agent收口总纲：
  - [40-cmp-non-five-agent-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/40-cmp-non-five-agent-closure-outline.md)
- TAP capability family 与三角色总装配总纲：
  - [41-tap-capability-family-and-three-agent-assembly-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/41-tap-capability-family-and-three-agent-assembly-outline.md)
- TAP 第一波 capability 接入任务包：
  - [tap-first-wave-capability-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/tap-first-wave-capability-task-pack/README.md)
- CMP infra 并行编码任务包：
  - [cmp-infra-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-task-pack/README.md)
- CMP infra 收尾并行编码任务包：
  - [cmp-infra-closure-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-infra-closure-task-pack/README.md)
- RAX CMP 工作流接入任务包：
  - [rax-cmp-workflow-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/rax-cmp-workflow-task-pack/README.md)
- CMP runtime 正式接入与联调任务包：
  - [cmp-runtime-live-integration-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-runtime-live-integration-task-pack/README.md)
- CMP 非五-agent收口任务包：
  - [cmp-non-five-agent-closure-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/README.md)
  - [cmp-non-five-agent-closure-task-pack/part0-program-control/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/part0-program-control/README.md)
- TAP capability family 与三角色并行任务包：
  - [tap-capability-family-and-three-agent-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/tap-capability-family-and-three-agent-task-pack/README.md)
- CMP 并行编码任务包：
  - [cmp-implementation-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-implementation-task-pack/README.md)
- T/A Pool 并行编码任务包：
  - [ta-pool-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/ta-pool-task-pack/README.md)
- TAP 第二阶段可用化任务包：
  - [tap-usable-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/tap-usable-task-pack/README.md)
- Agent Core 并行编码任务包：
  - [agent-core-runtime-kernel-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/agent-core-runtime-kernel-task-pack/README.md)
- CMP 最终收尾总纲：
  - [46-cmp-final-closure-outline.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/46-cmp-final-closure-outline.md)
- CMP 最终收尾任务包：
  - [cmp-final-closure-task-pack/README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-final-closure-task-pack/README.md)
