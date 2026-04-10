import Testing
@testable import PraxisToolingContracts

struct PraxisToolingContractsTests {
  @Test
  func shellAndGitDoublesCaptureStructuredRequests() async throws {
    let shell = PraxisFakeShellExecutor(
      resultsByCommand: [
        "git status --short": .init(stdout: " M file.swift", stderr: "", exitCode: 0, durationMilliseconds: 15)
      ]
    )
    let shellCommand = PraxisShellCommand(
      command: "git status --short",
      workingDirectory: "/tmp/praxis",
      environment: ["LANG": "en_US.UTF-8"],
      timeoutSeconds: 5,
      outputMode: .buffered
    )
    let shellResult = try await shell.run(shellCommand)

    #expect(shellResult.stdout.contains("file.swift"))
    #expect((await shell.allExecutedCommands()).first?.workingDirectory == "/tmp/praxis")

    let gitExecutor = PraxisFakeGitExecutor()
    let gitPlan = PraxisGitPlan(
      operationID: "git-op-1",
      repositoryRoot: "/tmp/praxis",
      steps: [
        .init(kind: .fetch, summary: "Fetch origin", arguments: ["remote": "origin"]),
        .init(kind: .checkout, summary: "Checkout branch", arguments: ["branch": "swift-refactor"]),
      ],
      summary: "Update local branch"
    )
    let gitReceipt = try await gitExecutor.apply(gitPlan)

    #expect(gitReceipt.operationID == "git-op-1")
    #expect((await gitExecutor.allPlans()).first?.steps.count == 2)
  }

  @Test
  func browserGroundingAndProcessContractsExposeStructuredReceipts() async throws {
    let browser = PraxisSpyBrowserExecutor(
      receiptFactory: {
        PraxisBrowserNavigationReceipt(
          requestedURL: $0.url,
          finalURL: "https://example.com/final",
          title: $0.preferredTitle,
          snapshotPath: $0.captureSnapshot ? "snapshots/final.txt" : nil
        )
      }
    )
    let navigationReceipt = try await browser.navigate(
      .init(
        url: "https://example.com/start",
        waitPolicy: .networkIdle,
        timeoutSeconds: 8,
        preferredTitle: "Example",
        captureSnapshot: true
      )
    )

    #expect(navigationReceipt.finalURL == "https://example.com/final")
    #expect((await browser.allRequests()).first?.waitPolicy == .networkIdle)

    let collector = PraxisStubBrowserGroundingCollector { request in
      PraxisBrowserGroundingEvidenceBundle(
        request: request,
        pages: [
          .init(
            role: .verifiedSource,
            url: "https://example.com/final",
            title: "Example",
            snapshotPath: "snapshots/final.txt",
            capturedAt: "2026-04-10T21:00:00Z"
          )
        ],
        facts: [
          .init(
            name: "final_url",
            status: .verified,
            value: "https://example.com/final",
            sourceRole: .verifiedSource,
            sourceURL: "https://example.com/final",
            sourceTitle: "Example",
            citationSnippet: "Loaded page title Example",
            observedAt: "2026-04-10T21:00:00Z"
          )
        ],
        generatedAt: "2026-04-10T21:00:01Z"
      )
    }
    let groundingBundle = try await collector.collectEvidence(
      .init(
        taskSummary: "Verify final URL",
        exampleURL: "https://example.com/start",
        requestedFacts: ["final_url"],
        locale: "en-US",
        maxPages: 3
      )
    )

    #expect(groundingBundle.request?.requestedFacts == ["final_url"])
    #expect(groundingBundle.facts.first?.citationSnippet == "Loaded page title Example")

    let handle = PraxisLongRunningTaskHandle(identifier: "proc-1", origin: .shell, startedAt: "2026-04-10T21:00:00Z")
    let supervisor = PraxisStubProcessSupervisor(
      updatesByIdentifier: [
        "proc-1": .init(handle: handle, status: .succeeded, stdoutTail: "done", exitCode: 0, finishedAt: "2026-04-10T21:00:02Z")
      ]
    )
    let update = try await supervisor.poll(handle: handle)

    #expect(update.status == .succeeded)
    #expect(update.stdoutTail == "done")
  }

  @Test
  func gitProbeCarriesWorktreeAndRemediationHints() async {
    let probe = PraxisStubGitAvailabilityProbe(
      report: .init(
        status: .installPromptExpected,
        executablePath: nil,
        versionString: nil,
        supportsWorktree: false,
        remediationHint: "Install Xcode Command Line Tools",
        notes: "macOS may prompt on first git invocation"
      )
    )

    let report = await probe.probeGitReadiness()

    #expect(report.status == .installPromptExpected)
    #expect(report.remediationHint == "Install Xcode Command Line Tools")
    #expect(report.supportsWorktree == false)
  }
}
