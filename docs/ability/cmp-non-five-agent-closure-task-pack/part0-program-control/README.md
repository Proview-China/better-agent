# CMP Non-Five-Agent Part 0 Task Pack

状态：主线程编排层，不分给普通 worker。

更新时间：2026-03-25

## 这一包是干什么的

Part 0 不负责单个业务域，而是负责整轮 `CMP` 非五-agent收口的编排、冲突治理和总装。

它是：

- 主线程专属层

它不是：

- 普通 worker 可自由领取的 Part

## 责任边界

主线程默认负责：

- 冻结总包 README
- 冻结每一波放行条件
- 管理单写者文件
- 仲裁 cross-part 依赖
- 统一把 helper 接回主链
- 做最终联调和验收

## 单写者文件

默认只允许主线程或显式授权单写者修改：

- [runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.ts)
- [runtime.test.ts](/home/proview/Desktop/Praxis_series/Praxis/src/agent_core/runtime.test.ts)
- [cmp-facade.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-facade.ts)
- [cmp-runtime.ts](/home/proview/Desktop/Praxis_series/Praxis/src/rax/cmp-runtime.ts)
- [README.md](/home/proview/Desktop/Praxis_series/Praxis/docs/ability/cmp-non-five-agent-closure-task-pack/README.md)

## 推荐文件列表

- `00-wave0-scope-freeze.md`
- `01-write-domain-map.md`
- `02-global-wave-release-rules.md`
- `03-high-conflict-file-policy.md`
- `04-cross-part-integration-sheet.md`
- `05-final-integration-and-acceptance.md`

## 最小验收口径

- 所有 Part 的波次边界明确
- 高冲突文件有单写者
- helper 与主线接线职责已分离
- 最终联调和 acceptance gate 有主线程总装口径
