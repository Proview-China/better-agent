# Part 7 Multi-Agent Orchestration

## 目标

把 `CMP` 最终收尾任务包改造成适合超多智能体协同的执行蓝图。

## 当前资源上限

- 最多 `1024` 个 agents
- 最深 `9` 层

## 推荐实际使用策略

### 推荐常态并发

- `16-48` 个 agents

### 推荐常态深度

- `3-4` 层

### 为什么不建议一开始直接炸到上百个

1. 文件 ownership 冲突会急剧增加
2. runtime / facade / tests 这些总装面本来就必须回到主线程
3. 上游模型限流依旧可能出现
4. 真实联调阶段并发过高会导致证据流混乱

## 顶层调度图

### 主线程

主线程永远只做：

1. 维护依赖图
2. 决定串并行节奏
3. 独占修改 runtime / rax 收口面
4. 负责最终联调
5. 负责最终 commit

### 一级 worker 组

建议一级直接拆成下面 10 组：

1. 对象模型
2. `ICMA`
3. `Iterator`
4. `Checker`
5. `DBAgent`
6. `Dispatcher`
7. bundle schema
8. `TAP` deep bridge
9. live infra / compose
10. recovery / acceptance gate

### 二级 worker 组

一级 worker 继续拆时，只能按子对象或子流程拆。

#### `DBAgent`

- request state
- section finalization
- package materialization
- snapshot attach
- passive request review
- reintervention review

#### `Dispatcher`

- core return package
- child seed package
- peer exchange package
- route record
- delivery record
- approval record

#### live infra

- compose topology
- postgres schema / bootstrap
- redis schema / bootstrap
- git service / adapter
- logging
- status panel

### 三级 worker 组

三级 worker 只允许拥有：

- 单一 schema 文件
- 单一测试文件
- 单一 compose service
- 单一 adapter / connector

不要跨多个 part 写代码。

## 任务依赖与阻塞规则

### 强阻塞项

下面没稳定前，不要大规模开后面的 worker：

1. `request / section / package / snapshot` 对象模型
2. 三类包共同主干字段
3. 主线程定义好的 runtime / rax 收口接口

### 弱阻塞项

下面可以边做边调：

1. 五角色 LLM I/O
2. `TAP` deep bridge
3. observability

### 后置项

下面必须尽量靠后：

1. live infra burn-in
2. acceptance gate
3. 全量 smoke

## 联调责任

### 局部联调

每个一级 worker 负责自己 write scope 内：

- 单元测试
- 本地 smoke
- 最小回读

### 交叉联调

主线程负责：

- 角色之间交叉联调
- runtime / rax 联调
- live infra 端到端联调

## 验收责任

### 一级 worker

必须交付：

1. 改了哪些文件
2. 为什么这些文件属于自己的 ownership
3. 跑了哪些测试
4. 还有什么没验证

### 主线程

必须最终确认：

1. typecheck
2. build
3. 五-agent 测试
4. runtime / rax 测试
5. 真实 infra 至少一条证据链
