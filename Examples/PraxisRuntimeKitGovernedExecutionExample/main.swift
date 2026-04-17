import Foundation
import PraxisRuntimeKit

@main
struct PraxisRuntimeKitGovernedExecutionExampleMain {
  static func main() async throws {
    let rootDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("praxis-runtime-kit-governed-execution-example", isDirectory: true)
      .appendingPathComponent(UUID().uuidString.lowercased(), isDirectory: true)
    try FileManager.default.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

    let client = try PraxisRuntimeClient.makeDefault(rootDirectory: rootDirectory)
    let capabilityIDs = Set(client.capabilities.catalog().capabilityIDs.map(\.rawValue))
    let sandbox = try await client.capabilities.describeCodeSandbox(
      .init(
        workingDirectory: rootDirectory.path,
        requestedRuntime: .swift
      )
    )

    let codeRunSummary: String
    if capabilityIDs.contains("code.run") {
      let result = try await client.capabilities.runCode(
        .init(
          summary: "Emit one bounded governed execution marker",
          runtime: .swift,
          source: "print(\"governed-code-run\")",
          workingDirectory: rootDirectory.path,
          timeoutSeconds: 2
        )
      )
      codeRunSummary = "risk=\(result.riskLabel) exit=\(result.exitCode)"
    } else {
      codeRunSummary = "unavailable"
    }

    let codePatchSummary: String
    if capabilityIDs.contains("code.patch") {
      let patchTargetURL = rootDirectory.appendingPathComponent("governed-example.txt", isDirectory: false)
      try "before\nvalue\n".write(to: patchTargetURL, atomically: true, encoding: .utf8)
      let result = try await client.capabilities.patchCode(
        .init(
          summary: "Apply one bounded governed execution patch",
          changes: [
            .init(
              path: "governed-example.txt",
              patch: """
              @@ -1,2 +1,2 @@
               before
              -value
              +patched
              """
            )
          ]
        )
      )
      codePatchSummary = "risk=\(result.riskLabel) changedPaths=\(result.changedPaths.joined(separator: ","))"
    } else {
      codePatchSummary = "unavailable"
    }

    let shellApproval = try await client.capabilities.requestShellApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local",
        requestedTier: .b2,
        summary: "Request bounded shell execution for governed execution example"
      )
    )
    let shellApprovalReadback = try await client.capabilities.readbackShellApproval(
      .init(
        projectID: "cmp.local-runtime",
        agentID: "runtime.local",
        targetAgentID: "checker.local"
      )
    )
    let shell = try await client.capabilities.runShell(
      .init(
        summary: "Emit one bounded governed shell marker",
        command: "printf 'governed-shell-run\\n'",
        workingDirectory: rootDirectory.path,
        timeoutSeconds: 2
      )
    )
    let activatedSkill = try await client.capabilities.activateSkill(
      .init(
        skillKey: "runtime.inspect",
        reason: "Exercise the governed execution provider skill path"
      )
    )
    let toolCall = try await client.capabilities.callTool(
      .init(
        toolName: "web.search",
        summary: "Exercise the governed execution MCP tool path",
        serverName: "local-example"
      )
    )

    print("Praxis RuntimeKit Governed Execution Example")
    print("sandbox.profile: \(sandbox.profile.rawValue)")
    print("sandbox.enforcement: \(sandbox.enforcementMode.rawValue)")
    print("code.run: \(codeRunSummary)")
    print("code.patch: \(codePatchSummary)")
    print("shell.approve: outcome=\(shellApproval.outcome)")
    print("shell.readback: found=\(shellApprovalReadback.found) state=\(shellApprovalReadback.humanGateState ?? "none")")
    print("shell.run: risk=\(shell.riskLabel) exit=\(shell.exitCode)")
    print("skill.activate: key=\(activatedSkill.skillKey) activated=\(activatedSkill.activated)")
    print("tool.call: name=\(toolCall.toolName)")
  }
}
