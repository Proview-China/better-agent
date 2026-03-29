# CMP Five-Agent Configuration Task Pack

状态：下一阶段执行任务清单。

更新时间：2026-03-25

## 这包任务处理什么

这包任务专门处理五个 agent 的下一阶段工作：

- 五套角色配置
- `TAP -> CMP` 基础能力接线
- 受控父子协作
- 失败恢复与观测面联调

它不是：

- `CMP` 非五-agent 公共底座收口包
- `MP` 实现包
- 五-agent 再写一轮骨架包

## 当前唯一目标

把已经接进主链的五-agent runtime，从“代码骨架可跑”推进到：

- 角色配置真实可用
- 角色能力真实可控
- 父子协作真实可联调

## 下一阶段的总顺序

### Wave A / 角色配置面

先做五套角色的：

- prompt
- profile
- capability contract

顺序：

1. `ICMA`
2. `Iterator`
3. `Checker`
4. `DBAgent`
5. `Dispatcher`

### Wave B / `TAP` 基础能力接线

先接：

- git
- db
- mq

然后再补：

- 角色所需工具能力

### Wave C / 受控协作链

重点做：

- 子节点中途再干预
- 父 `DBAgent` 处理
- 父主 agent 显式批准 peer exchange
- 子链精裁

### Wave D / 恢复与观测联调

重点做：

- 同链路回卷恢复
- 角色阶段可见性
- 包流向可见性
- `rax.cmp` 只读控制台加厚

## Part A / 五套角色配置

### 目标

把五个 agent 的行为真正分开。

### 子任务

1. `ICMA` 配置包
- 固定意图切块规则
- 固定 fragment 模板
- 固定种子装配规则

2. `Iterator` 配置包
- 固定 commit 推进纪律
- 固定 review ref 规则
- 固定 git 写权限提示词约束

3. `Checker` 配置包
- 固定证据重整与历史检查规则
- 固定子链精裁策略
- 固定父 `Checker` 的辅助职责

4. `DBAgent` 配置包
- 固定主包/时间线附包/task snapshot 的出包策略
- 固定再干预请求的处理模板
- 固定父侧主审话术与决策约束

5. `Dispatcher` 配置包
- 固定包路由规则
- 固定 child/peer/passive return 话术与行为
- 固定不越权不再裁剪的边界

### 建议并发

- `ICMA` 一路
- `Iterator + Checker` 一路
- `DBAgent` 一路
- `Dispatcher` 一路
- 主线程负责统一 profile 命名、配置格式和共享变量

## Part B / `TAP -> CMP` 基础能力接线

### 目标

把五个角色真正接上差异化能力，而不是只靠默认 runtime 假设。

### 子任务

1. 角色 git 能力矩阵
- `ICMA` 禁写
- `Iterator` 主写
- `Checker` 有限修正
- `DBAgent` 不抢 git 主推进
- `Dispatcher` 不拿 git 推进能力

2. 角色 db 能力矩阵
- `DBAgent` 主写
- 其他角色默认只读或提交候选

3. 角色 mq 能力矩阵
- `ICMA` 发邻接输入相关消息
- `Dispatcher` 发交付相关消息
- 其余角色按需最小化

4. 工具能力补位
- 在 git/db/mq 接稳后
- 再补每个角色真正需要的工具能力

### 建议并发

- git contract 一路
- db contract 一路
- mq contract 一路
- 主线程统一收 capability 名称、最小权限面和 `TAP` 接线点

## Part C / 父子协作与受控再干预

### 目标

把父子协作做成真正受控协议，而不是松散广播。

### 子任务

1. 子节点再干预请求
- 子链发现漂移或上下文不足时
- 带“缺口说明 + 当前状态”向父 `DBAgent` 请求补包

2. 父 `DBAgent` 处理链
- 先受理请求
- 再决定是否需要父 `Checker` 辅助重整与证据裁剪

3. 父主 agent 显式批准链
- peer exchange 最终拍板进入父主 agent
- 不是池内角色自己闭环到底

4. 子 `Checker` 精裁链
- 父先粗裁
- 子再精裁

### 建议并发

- 子请求协议一路
- 父 `DBAgent` 处理一路
- 父 `Checker` 辅助一路
- 父主 agent 显式批准一路

## Part D / 恢复与观测联调

### 目标

让五个 agent 在真实联调中可观察、可回卷、可定位问题。

### 子任务

1. 同链路回卷恢复
- 不是单角色裸恢复
- 也不是整池恢复

2. 角色阶段观测
- 每个角色当前跑到哪

3. 包流向观测
- 主包去了哪里
- 时间线附包是否挂上
- peer exchange 和 child seed 是怎么走的

4. `rax.cmp` 控制台加厚
- `readback`
- `smoke`
- 角色 summary
- 包流向 summary

### 建议并发

- 恢复策略一路
- 角色阶段 summary 一路
- 包流向 summary 一路
- `rax.cmp` facade/runtime 收口由主线程负责

## 主线程职责

主线程仍然独占这些收口面：

- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.ts)
- [runtime.test.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.test.ts)
- [cmp-facade.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-facade.ts)
- [cmp-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-runtime.ts)
- [cmp-types.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-types.ts)

## 压缩后开工顺序

压缩回来后，直接按下面顺序执行：

1. 先做 Part A
2. 再做 Part B
3. 再做 Part C
4. 最后做 Part D

不要回跳到：

- 非五-agent 底座
- `MP`
- 与当前阶段无关的 `TAP` 文档脏改动
