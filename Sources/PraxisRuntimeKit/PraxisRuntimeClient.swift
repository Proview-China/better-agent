import Foundation
import PraxisGoal
import PraxisRuntimeFacades
import PraxisRuntimeGateway

/// High-level Swift framework API over the host-neutral runtime facade.
///
/// This client is the caller-friendly entrypoint for local Swift integrations. It hides transport
/// envelopes and request payload wrappers while keeping the lower-level facade available as an
/// implementation detail behind the gateway bootstrap.
public final class PraxisRuntimeClient: Sendable {
  private let inspectionFacade: PraxisInspectionFacade
  private let capabilityFacade: PraxisCapabilityFacade
  private let cmpFacade: PraxisCmpFacade
  private let mpFacade: PraxisMpFacade
  private let runFacade: PraxisRunFacade

  init(runtimeFacade: PraxisRuntimeFacade) {
    self.inspectionFacade = runtimeFacade.inspectionFacade
    self.capabilityFacade = runtimeFacade.capabilityFacade
    self.cmpFacade = runtimeFacade.cmpFacade
    self.mpFacade = runtimeFacade.mpFacade
    self.runFacade = runtimeFacade.runFacade
  }

  /// Creates a runtime client backed by local default host adapters.
  ///
  /// - Parameter rootDirectory: Optional runtime root directory. When omitted, the local runtime chooses its default root.
  /// - Returns: A runtime client ready for direct Swift calls.
  /// - Throws: Any dependency graph validation error raised while assembling the runtime facade.
  public static func makeDefault(
    rootDirectory: URL? = nil
  ) throws -> PraxisRuntimeClient {
    try PraxisRuntimeClient(
      runtimeFacade: PraxisRuntimeGatewayFactory.makeRuntimeFacade(rootDirectory: rootDirectory)
    )
  }

  /// High-level run access grouped behind a dedicated execution client.
  public var runs: PraxisRuntimeRunClient {
    PraxisRuntimeRunClient(runFacade: runFacade)
  }

  /// Thin capability baseline access grouped behind a dedicated capability client.
  public var capabilities: PraxisRuntimeCapabilityClient {
    PraxisRuntimeCapabilityClient(capabilityFacade: capabilityFacade)
  }

  /// High-level TAP access grouped behind a dedicated scoped client.
  public var tap: PraxisRuntimeTapClient {
    PraxisRuntimeTapClient(inspectionFacade: inspectionFacade)
  }

  /// High-level CMP access grouped behind a dedicated scoped client.
  public var cmp: PraxisRuntimeCmpClient {
    PraxisRuntimeCmpClient(
      cmpFacade: cmpFacade,
      inspectionFacade: inspectionFacade
    )
  }

  /// High-level MP access grouped behind a dedicated scoped client.
  public var mp: PraxisRuntimeMpClient {
    PraxisRuntimeMpClient(
      mpFacade: mpFacade,
      inspectionFacade: inspectionFacade
    )
  }
}
