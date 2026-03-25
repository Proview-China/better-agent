# Part 0 / 04 Cross-Part Integration Sheet

状态：主线程编排文档。

更新时间：2026-03-25

## 依赖矩阵

### Part 1 -> Part 2

- truth model 会约束 Section / Rules 的语义边界

### Part 1 -> Part 4 / Part 5

- truth precedence 会约束 DB / Redis 的最终判定口径

### Part 2 -> Part 4 / Part 6

- section-first lowering 会影响 package rebuild / recovery 对象来源

### Part 3 -> Part 4 / Part 6

- git checked/promoted truth 会影响 DB fallback 和 git rebuild

### Part 4 -> Part 6 / Part 8

- projection/package truth 会影响 recovery 和 final acceptance

### Part 5 -> Part 8

- delivery truth 会影响 final gate 的 dispatch/ack 验收

### Part 7 -> Part 8

- manual control surface 会影响最终 readiness gate

## 主线程总装顺序

1. 先收 Part 1 的 truth/readback
2. 再收 Part 2 的 section-first
3. 再收 Part 3/4/5 三层真相
4. 再收 Part 6 recovery
5. 再收 Part 7 manual controls
6. 最后收 Part 8 acceptance gates
