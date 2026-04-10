import Testing
@testable import PraxisWorkspaceContracts

struct PraxisWorkspaceContractsTests {
  @Test
  func workspaceReaderSearcherAndWriterExposeStructuredContracts() async throws {
    let reader = PraxisFakeWorkspaceReader(
      filesByPath: [
        "/tmp/praxis/README.md": .init(
          path: "/tmp/praxis/README.md",
          content: "# Praxis\n",
          revisionToken: "rev-1",
          lineCount: 1
        )
      ]
    )
    let readResult = try await reader.read(
      .init(
        path: "/tmp/praxis/README.md",
        includeRevisionToken: true
      )
    )
    let rangedReadResult = try await reader.read(
      .init(
        path: "/tmp/praxis/README.md",
        range: .init(startLine: 1, endLine: 1),
        includeRevisionToken: false
      )
    )

    #expect(readResult.revisionToken == "rev-1")
    #expect(rangedReadResult.content == "# Praxis")
    #expect(rangedReadResult.revisionToken == nil)
    #expect(rangedReadResult.lineCount == 1)
    #expect((await reader.allRequests()).first?.includeRevisionToken == true)

    let searcher = PraxisStubWorkspaceSearcher(
      resultsByQuery: [
        "Praxis": [
          .init(
            path: "/tmp/praxis/README.md",
            line: 1,
            column: 3,
            summary: "README heading",
            snippet: "# Praxis"
          )
        ]
      ]
    )
    let searchMatches = try await searcher.search(
      .init(query: "Praxis", kind: .fullText, roots: ["/tmp/praxis"], maxResults: 5)
    )

    #expect(searchMatches.first?.snippet == "# Praxis")
    #expect(searchMatches.first?.line == 1)

    let writer = PraxisSpyWorkspaceWriter()
    let receipt = try await writer.apply(
      .init(
        changes: [
          .init(kind: .updateFile, path: "/tmp/praxis/README.md", content: "# Praxis\nUpdated\n", expectedRevisionToken: "rev-1"),
          .init(kind: .createFile, path: "/tmp/praxis/NOTES.md", content: "Notes\n")
        ],
        changeSummary: "Refresh project notes"
      )
    )

    #expect(receipt.appliedChangeCount == 2)
    #expect(receipt.changedPaths == ["/tmp/praxis/README.md", "/tmp/praxis/NOTES.md"])
    #expect((await writer.allRequests()).first?.changes.first?.expectedRevisionToken == "rev-1")
  }

  @Test
  func workspaceReaderSlicesLineRangesWithoutLeakingRevisionTokens() async throws {
    let reader = PraxisFakeWorkspaceReader(
      filesByPath: [
        "/tmp/praxis/NOTES.md": .init(
          path: "/tmp/praxis/NOTES.md",
          content: "alpha\nbeta\ngamma",
          revisionToken: "rev-2",
          lineCount: 3
        )
      ]
    )

    let readResult = try await reader.read(
      .init(
        path: "/tmp/praxis/NOTES.md",
        range: .init(startLine: 2, endLine: 3),
        includeRevisionToken: false
      )
    )

    #expect(readResult.content == "beta\ngamma")
    #expect(readResult.lineCount == 2)
    #expect(readResult.revisionToken == nil)
  }
}
