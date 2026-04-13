import PraxisCoreTypes
import PraxisRuntimeGateway
import PraxisRuntimeInterface

public enum PraxisFFIModule {
  public static let boundary = PraxisBoundaryDescriptor(
    name: "PraxisFFI",
    responsibility: "为跨语言宿主导出最小 encoded runtime bridge；只包装 runtime interface registry、codec 与 session/event envelope，不承担 UI、terminal 或 provider 语义。",
    tsModules: [
      "src/agent_core/runtime.ts",
      "src/agent_core/live-agent-chat/shared.ts",
    ],
  )
}

/// Builds the thin encoded FFI bridge over the host-neutral runtime gateway.
///
/// This target intentionally stays narrow: it only packages the runtime interface registry and
/// codec-backed request/event envelope surface. It does not define UI or terminal presentation.
public enum PraxisFFIFactory {
  /// Builds a default runtime interface session for the thin FFI export path.
  ///
  /// - Returns: One host-neutral runtime interface session.
  /// - Throws: Any dependency graph validation error raised by the gateway bootstrap.
  public static func makeRuntimeInterface() throws -> PraxisRuntimeInterfaceSession {
    try PraxisRuntimeGatewayFactory.makeRuntimeInterface()
  }

  /// Builds a default runtime interface registry for the thin FFI export path.
  ///
  /// - Returns: A registry that lazily materializes runtime interface sessions.
  public static func makeRuntimeInterfaceRegistry() -> PraxisRuntimeInterfaceRegistry {
    PraxisRuntimeGatewayFactory.makeRuntimeInterfaceRegistry()
  }

  /// Builds the default FFI bridge backed by the shared local host adapters.
  ///
  /// - Returns: A bridge that exposes the encoded runtime interface over opaque session handles.
  public static func makeFFIBridge() -> PraxisFFIBridge {
    PraxisFFIBridge(
      runtimeInterfaceRegistry: makeRuntimeInterfaceRegistry()
    )
  }
}
