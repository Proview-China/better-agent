# Part 2 Five-Agent Real Loop And LLM IO

## 目标

把五个 agent 从“配置对象”推进到“真实 loop + 明确 LLM I/O 契约”。

## 子任务

1. `ICMA`
- 全量会话面进入预处理
- 生成 `pre-section`
- 输出：
  - 意图
  - 来源
  - 候选正文
  - 边界
  - 显式 fragment
  - 双层 guide

2. `Iterator`
- 进入自然 git workflow
- 管：
  - `commit`
  - `PR`
  - `merge`
  - `review ref`

3. `Checker`
- 产出 section 级：
  - 拆分
  - 合并
  - 去噪
  - 精裁
  - 双层理由

4. `DBAgent`
- 收候选
- 出定版
- 审请求
- 定版 section
- 出 package
- 挂 snapshot / skill / timeline

5. `Dispatcher`
- 产出三类包
- 写 route record
- 管 delivery / approval / governance fields
