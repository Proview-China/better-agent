import PraxisToolingContracts

public enum PraxisLocalHostPlatformSupport {
  public static var supportsNativeCommandExecution: Bool {
#if os(macOS)
    true
#else
    false
#endif
  }

  public static var localRuntimeLabel: String {
#if os(macOS)
    "macOS local runtime"
#elseif os(Linux)
    "Linux local runtime"
#else
    "non-macOS local runtime"
#endif
  }

  public static var semanticIndexLabel: String {
#if os(macOS)
    "accelerate-like semantic index"
#else
    "local semantic index"
#endif
  }

  public static var nativeGitExecutablePaths: [String] {
#if os(macOS)
    [
      "/usr/bin/git",
      "/opt/homebrew/bin/git",
      "/usr/local/bin/git",
    ]
#else
    []
#endif
  }

  public static var nativeShellExecutablePath: String? {
#if os(macOS)
    "/bin/zsh"
#else
    nil
#endif
  }

  public static var nativeProcessInspectionExecutablePath: String? {
#if os(macOS)
    "/bin/ps"
#else
    nil
#endif
  }

  public static var scaffoldGitAvailabilityStatus: PraxisGitAvailabilityStatus {
#if os(macOS)
    .installPromptExpected
#else
    .unavailable
#endif
  }

  public static var scaffoldGitExecutablePath: String? {
#if os(macOS)
    "/usr/bin/git"
#else
    nil
#endif
  }

  public static var scaffoldGitSupportsWorktree: Bool {
#if os(macOS)
    true
#else
    false
#endif
  }

  public static var scaffoldGitNotes: String {
#if os(macOS)
    "Scaffold local-runtime git profile."
#elseif os(Linux)
    "Scaffold local-runtime git profile remains a Linux placeholder."
#else
    "Scaffold local-runtime git profile remains a platform placeholder."
#endif
  }

  public static var scaffoldGitRemediationHint: String {
#if os(macOS)
    "Command Line Tools may still need first-run installation."
#elseif os(Linux)
    "Git wiring for the Linux local runtime is not implemented yet."
#else
    "Git wiring for this local runtime platform is not implemented yet."
#endif
  }

  public static var gitMissingRemediationHint: String {
#if os(macOS)
    "Install Xcode Command Line Tools or Git before using local runtime git features."
#elseif os(Linux)
    "Install Git and provide a Linux host adapter implementation before using local runtime git features."
#else
    "Provide a platform-specific host adapter implementation before using local runtime git features."
#endif
  }

  public static var gitInstallPromptSummary: String {
#if os(macOS)
    "System git is expected to prompt for Command Line Tools on first use."
#elseif os(Linux)
    "System git needs Linux-specific activation before the local runtime can use it."
#else
    "System git needs platform-specific activation before the local runtime can use it."
#endif
  }

  public static var gitInstallPromptFallbackIssue: String {
#if os(macOS)
    "System git may still need Command Line Tools installation."
#elseif os(Linux)
    "System git activation still needs a Linux host adapter implementation."
#else
    "System git activation still needs a platform-specific host adapter implementation."
#endif
  }

  public static var gitActivationRemediationHint: String {
#if os(macOS)
    "Launch `git --version` once in Terminal or install Xcode Command Line Tools to finish enabling system git."
#elseif os(Linux)
    "Linux local runtime git activation is not implemented yet; provide a Linux host adapter implementation."
#else
    "Local runtime git activation is not implemented for this platform yet."
#endif
  }

  public static var gitActivationNotes: String {
#if os(macOS)
    "System git exists but appears to still require Command Line Tools activation."
#elseif os(Linux)
    "System git exists, but Linux local runtime activation has not been implemented yet."
#else
    "System git exists, but local runtime activation has not been implemented for this platform yet."
#endif
  }

  public static var gitActivationSignalPhrases: [String] {
#if os(macOS)
    [
      "xcode-select",
      "command line tools",
      "developer tools",
    ]
#else
    []
#endif
  }

  public static var unsupportedShellMessage: String {
    "Native shell execution is only wired for the macOS local runtime baseline today."
  }

  public static var unsupportedGitExecutionMessage: String {
    "System git execution is only wired for the macOS local runtime baseline today."
  }

  public static var unsupportedProcessSupervisorMessage: String {
    "Process supervision is only wired for the macOS local runtime baseline today."
  }
}
