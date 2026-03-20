# 2026-03-20 CMP Implementation Task Pack

## 当前阶段结论

`CMP` 的实施工作已经不再只是总纲与四份指导性分册，而是继续被拆成一套可直接用于多智能体执行的四组任务包。

任务包总入口：

- `docs/ability/cmp-implementation-task-pack/README.md`

四个 part 目录：

- `part1-core-interface-and-object-model`
- `part2-git-lineage-and-sync-governance`
- `part3-db-projection-and-neighborhood-broadcast`
- `part4-five-agent-runtime-and-delivery`

## 当前冻结的执行策略

- 主线程负责：
  - 全局协议收口
  - 跨 Part 依赖仲裁
  - 最终联调与测试门控
- 二层 lead 固定为 `4`
- 三层 specialist 建议控制在 `8-12`
- 当前推荐总 agent 数控制在 `13-17`

## 当前冻结的模型建议

- 默认写协议、写代码、写 runtime：`gpt-5.4-high`
- 轻量文档、fixtures、test scaffolding：`gpt-5.4-medium`
- 高耦合协议争议、non-skipping / visibility 状态机、runtime recovery / end-to-end 闭环：`gpt-5.4-xhigh`

## 当前冻结的全局串并行顺序

1. Global Wave 0
   - 主线程先冻结 Part 1 `00`
2. Global Wave 1
   - Part 1 `01/02/03`
   - 其他 Part 只允许起 `00` 草案
3. Global Wave 2
   - Part 1 `04/05`
   - Part 2 `01/02/03`
   - Part 3 `01/02/03`
   - Part 4 `00`
4. Global Wave 3
   - Part 1 `06/07`
   - Part 2 `04/05/06`
   - Part 3 `04/05/06`
   - Part 4 `01/02/03`
5. Global Wave 4
   - Part 1 `08`
   - Part 2 `07/08/09`
   - Part 3 `07/08/10`
   - Part 4 `04/05/06`
6. Global Wave 5
   - Part 2 `10/11`
   - Part 3 `09/11/12`
   - Part 4 `07/08`

## 当前最重要的执行纪律

- Part 1 `00` 没冻结前，四个 Part 都不要正式写共享协议。
- `07/08/10/11/12` 这类 integration / smoke / recovery 文件默认后置。
- 所有 worker 都有联调和测试义务，不能只交单文件完成。
- 三层 specialist 必须单一写域，不允许跨文件夹改共享协议。
