# 2026-04-11 Runtime Use Cases CMP 测试下沉

## 背景

- 上一轮已经把 HostRuntime 的 CMP 对外表面从单一 `cmpFacade` 收紧成 `session / project / flow / roles / control / readback` 分面。
- 但行为验证仍主要集中在 facade / architecture tests，`PraxisRuntimeUseCases` 自身还缺一层独立测试，导致：
  - neutral command 到 use case 结果模型之间的 contract 不够直接；
  - 容易继续依赖 facade 投影字段，而不是 use case domain model；
  - 后续 RuntimeInterface / FFI 如果直接绑定 use case contract，回归定位会偏晚。

## 本轮实现

- 新增独立 test target：`PraxisRuntimeUseCasesTests`
- 新增测试文件：`Tests/PraxisRuntimeUseCasesTests/PraxisRuntimeUseCasesTests.swift`

覆盖面分三块：

1. `session / project / smoke`
   - 直接验证 `PraxisOpenCmpSessionUseCase`
   - 直接验证 `PraxisBootstrapCmpProjectUseCase`
   - 直接验证 `PraxisReadbackCmpProjectUseCase`
   - 直接验证 `PraxisSmokeCmpProjectUseCase`

2. `flow / roles`
   - 直接验证 `PraxisIngestCmpFlowUseCase`
   - 直接验证 `PraxisCommitCmpFlowUseCase`
   - 直接验证 `PraxisReadbackCmpRolesUseCase`
   - 重点确认断言落在 use case domain model，而不是 facade 派生字段

3. `control / peer approval / status`
   - 直接验证 `PraxisUpdateCmpControlUseCase`
   - 直接验证 `PraxisRequestCmpPeerApprovalUseCase`
   - 直接验证 `PraxisDecideCmpPeerApprovalUseCase`
   - 直接验证 `PraxisReadbackCmpControlUseCase`
   - 直接验证 `PraxisReadbackCmpPeerApprovalUseCase`
   - 直接验证 `PraxisReadbackCmpStatusUseCase`
   - 同时验证跨独立 dependency graph 的持久化读回，确保行为依赖 host-backed truth，而不是 facade 或进程内临时状态

## 边界结论

- `PraxisRuntimeUseCases` 可以直接作为 host-neutral 行为 contract 的测试落点，不需要再借道 CLI / GUI。
- facade 层和 RuntimeInterface 层应继续把 use case 结果视作上游真相，而不是重新发明另一套语义字段。
- use case 级断言应优先绑定：
  - `acceptedEventIDs`
  - `PraxisSectionIngressRecord.sections`
  - `PraxisCmpActiveLineRecord.stage`
  - `PraxisCmpControlSurface`
  - `PraxisCmpPeerApproval(Readback)`
  - `PraxisCmpStatusReadback`
- 不应继续把 facade 层的“计数字段/摘要字段”当成 use case 的天然 contract。

## 验证

- `swift test` 已通过
- 当前快照：
  - `178` tests
  - `47` suites

## 下一步建议

- 补 `PraxisRuntimeInterface` 的 CMP snapshot / error envelope contract tests，特别是把 use case 结果投影到稳定 envelope 的映射单独钉住。
- 开始按同样方式为 MP 建立 `workflow / memory / search / readback` 的 use case 级独立测试，而不是先扩 CLI 表面。
