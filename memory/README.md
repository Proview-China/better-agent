# Project Memory

这个目录用于存放仓库级记忆, 服务于 `better-agent` 的 infra 与 agent 研发过程。

它和 `~/.codex/memories/` 的区别如下:

- `~/.codex/memories/`:
  - 偏本机 / 个人 / Codex 运行时记忆
  - 适合保存跨仓库协作经验

- `memory/`:
  - 偏项目 / 团队 / 仓库内长期沉淀
  - 适合保存与 `better-agent` 直接相关的最佳实践、接口约束、测试样例、失败案例、调参结论

建议约定:

- `memory/entries/`
  - 存放结构化记忆条目
- `memory/research/`
  - 存放调研结论与对比材料
- `memory/runtime/`
  - 存放运行时导出的记忆快照或中间产物

当前阶段说明:

- 这里先作为仓库内记忆根目录落地
- 记忆引擎当前代码实现仍以 JSON 文件存储为主
- 后续若切到 `LanceDB` 或其他后端, 该目录可继续承担索引、导出、快照与人工校验材料的存放职责
