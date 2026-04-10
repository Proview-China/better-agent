# 2026-04-10 Wave5 HostContracts Midpoint

## 这轮继续做了什么

- 在已经完成 `PraxisInfraContracts` 的基础上，继续把以下三个 HostContracts target 从协议骨架推进到可测试 contract：
  - `PraxisToolingContracts`
  - `PraxisWorkspaceContracts`
  - `PraxisProviderContracts`

## ToolingContracts

- 补齐结构化 shell / browser / git / process contract：
  - shell command now carries cwd / env / timeout / output mode / PTY policy
  - browser navigation now returns receipt and supports wait policy / snapshot capture
  - git plan now carries operation id / repository root / step list / execution receipt
  - long-running process poll now returns structured task update instead of plain string
- 补齐 browser grounding request / evidence / citation metadata。
- 新增 test doubles：
  - `PraxisFakeShellExecutor`
  - `PraxisSpyBrowserExecutor`
  - `PraxisStubBrowserGroundingCollector`
  - `PraxisStubGitAvailabilityProbe`
  - `PraxisFakeGitExecutor`
  - `PraxisStubProcessSupervisor`

## WorkspaceContracts

- 补齐结构化 workspace read / search / change contract：
  - read request/result
  - search kind / roots / filePattern / snippet match
  - file change / patch / revision token / change receipt
- 新增 test doubles：
  - `PraxisFakeWorkspaceReader`
  - `PraxisStubWorkspaceSearcher`
  - `PraxisSpyWorkspaceWriter`

## ProviderContracts

- 补齐 host-facing provider contract：
  - capability execution receipt
  - inference request with system/context/model/temperature/capability hints
  - embedding request/response
  - file upload / batch enqueue / skill activation / MCP tool call request & receipt
  - richer web search request/result/response
- 新增 test doubles：
  - `PraxisStubCapabilityExecutor`
  - `PraxisStubProviderInferenceExecutor`
  - `PraxisStubProviderEmbeddingExecutor`
  - `PraxisFakeProviderFileStore`
  - `PraxisFakeProviderBatchExecutor`
  - `PraxisStubProviderSkillRegistry`
  - `PraxisFakeProviderSkillActivator`
  - `PraxisStubProviderMCPExecutor`

## 当前结论

- Wave5 已经完成 4/5：
  - Infra
  - Tooling
  - Workspace
  - Provider
- 还未继续的是 `PraxisUserIOContracts`。
- 现阶段的 HostRuntime 下一步可以优先依赖这些 doubles 接 use case / facade，而不是提前引入 live adapter。

## 验证

- 新增：
  - `PraxisToolingContractsTests`
  - `PraxisWorkspaceContractsTests`
  - `PraxisProviderContractsTests`
- `swift test` 通过，当前共 `85` 个测试
