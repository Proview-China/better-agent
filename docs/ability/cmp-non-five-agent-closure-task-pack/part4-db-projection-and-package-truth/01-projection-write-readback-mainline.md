# Part 4 / 01 Projection Write Readback Mainline

状态：Projection Truth Worker 任务文件。

更新时间：2026-03-25

## 当前唯一目标

先把 `projection` 这一层做出最小但真实的：

- write
- readback
- truth evidence

## 这一小块要交付什么

- projection lowering helper 不再只返回“写过 SQL”
- 至少返回一层结构化 `truthReadback`
- 能区分：
  - `present`
  - `missing`

## 最小验收口径

- projection lowering helper 有结构化 readback 结果
- 有最小测试覆盖：
  - readback present
  - readback missing
