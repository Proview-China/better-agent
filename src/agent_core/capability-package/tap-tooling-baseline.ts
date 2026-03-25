import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  type CapabilityPackage,
} from "./capability-package.js";

export const TAP_TOOLING_BASELINE_CAPABILITY_KEYS = [
  "repo.write",
  "shell.restricted",
  "test.run",
  "skill.doc.generate",
] as const;

export type TapToolingBaselineCapabilityKey =
  (typeof TAP_TOOLING_BASELINE_CAPABILITY_KEYS)[number];

function createWorkspaceScope(operations: string[]) {
  return {
    pathPatterns: ["workspace/**"],
    allowedOperations: operations,
  };
}

export function isTapToolingBaselineCapabilityKey(
  capabilityKey: string,
): capabilityKey is TapToolingBaselineCapabilityKey {
  return TAP_TOOLING_BASELINE_CAPABILITY_KEYS.includes(
    capabilityKey as TapToolingBaselineCapabilityKey,
  );
}

export function createTapToolingCapabilityPackage(
  capabilityKey: TapToolingBaselineCapabilityKey,
): CapabilityPackage {
  switch (capabilityKey) {
    case "repo.write": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:repo.write:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Repo-local write capability for bootstrap TMA.",
          tags: ["tap", "bootstrap", "repo", "write"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.repo.write",
          runtimeKind: "local-tooling",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:repo.write",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Repo-local write capability for bootstrap TMA.",
          dependencies: ["code.read"],
          tags: ["tap", "bootstrap", "repo", "write"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.repo.write",
          runtimeKind: "local-tooling",
          supports: ["write_text", "append_text", "mkdir"],
          prepare: { ref: "adapter.prepare:repo.write" },
          execute: { ref: "adapter.execute:repo.write" },
          cancel: { ref: "adapter.cancel:repo.write" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["write", "append", "mkdir", "repo.write"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["write", "append", "mkdir", "repo.write"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_write_only", "no_system_write"],
          humanGateRequirements: ["workspace_outside_write_requires_escalation"],
        },
        builder: {
          builderId: "builder.repo.write",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:repo.write",
          healthEntry: "health:repo.write",
          successCriteria: ["writes stay inside workspace", "created files are readable immediately"],
          failureSignals: ["path escapes workspace", "write payload missing"],
          evidenceOutput: ["changed-files", "write-report"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Write the smallest diff needed for the task.",
            "Keep paths repo-local and explicit.",
          ],
          knownLimits: [
            "Does not perform system-level writes.",
            "Rejects paths outside the configured workspace root.",
          ],
          exampleInvocations: [
            {
              exampleId: "repo.write.append-note",
              capabilityKey,
              operation: "append_text",
              input: {
                path: "memory/current-context.md",
                content: "Updated by bootstrap TMA.",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or revert repo diff",
          deprecateStrategy: "freeze new writes before removal",
          cleanupStrategy: "remove superseded registration after drain",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "shell.restricted": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:shell.restricted:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Restricted shell command runner for bootstrap TMA.",
          tags: ["tap", "bootstrap", "shell", "restricted"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.shell.restricted",
          runtimeKind: "local-tooling",
          commandPolicy: "restricted",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:shell.restricted",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Restricted shell command runner for bootstrap TMA.",
          dependencies: ["code.read"],
          tags: ["tap", "bootstrap", "shell", "restricted"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.shell.restricted",
          runtimeKind: "local-tooling",
          supports: ["exec"],
          prepare: { ref: "adapter.prepare:shell.restricted" },
          execute: { ref: "adapter.execute:shell.restricted" },
          cancel: { ref: "adapter.cancel:shell.restricted" },
          resultMapping: {
            successStatuses: ["success", "partial"],
            artifactKinds: ["verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["exec", "shell.restricted"]),
          },
          recommendedMode: "standard",
          riskLevel: "risky",
          defaultScope: createWorkspaceScope(["exec", "shell.restricted"]),
          reviewRequirements: ["allow_with_constraints"],
          safetyFlags: ["bounded_shell_only", "workspace_cwd_only", "deny_sudo_and_destructive_patterns"],
          humanGateRequirements: ["extended_side_effects_require_human_gate"],
        },
        builder: {
          builderId: "builder.shell.restricted",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:shell.restricted",
          healthEntry: "health:shell.restricted",
          successCriteria: ["command completes inside workspace", "stdout and stderr are captured"],
          failureSignals: ["command policy violation", "cwd escapes workspace", "command timeout"],
          evidenceOutput: ["stdout", "stderr", "exit-code"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Prefer explicit commands plus args instead of shell strings.",
            "Keep cwd inside the target repo and keep timeouts short.",
          ],
          knownLimits: [
            "Rejects sudo and destructive command patterns.",
            "Runs without shell expansion or pipelines.",
          ],
          exampleInvocations: [
            {
              exampleId: "shell.restricted.node-version",
              capabilityKey,
              operation: "exec",
              input: {
                command: "node",
                args: ["--version"],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or disable capability key",
          deprecateStrategy: "freeze new shell dispatch before removal",
          cleanupStrategy: "drain running work before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "test.run": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:test.run:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Targeted test runner for bootstrap TMA.",
          tags: ["tap", "bootstrap", "test", "runner"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.test.run",
          runtimeKind: "local-tooling",
          commandPolicy: "test-only",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:test.run",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Targeted test runner for bootstrap TMA.",
          dependencies: ["code.read", "shell.restricted"],
          tags: ["tap", "bootstrap", "test", "runner"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.test.run",
          runtimeKind: "local-tooling",
          supports: ["run"],
          prepare: { ref: "adapter.prepare:test.run" },
          execute: { ref: "adapter.execute:test.run" },
          cancel: { ref: "adapter.cancel:test.run" },
          resultMapping: {
            successStatuses: ["success", "partial"],
            artifactKinds: ["verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["exec", "test", "test.run"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["exec", "test", "test.run"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["repo_local_tests_only", "no_install_side_effects"],
          humanGateRequirements: ["extended_lane_for_install_or_networked_test_setup"],
        },
        builder: {
          builderId: "builder.test.run",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:test.run",
          healthEntry: "health:test.run",
          successCriteria: ["test command exits cleanly or reports failure output", "stdout and stderr are preserved"],
          failureSignals: ["non-test command requested", "cwd escapes workspace", "command timeout"],
          evidenceOutput: ["stdout", "stderr", "exit-code"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Prefer targeted test commands over full-suite runs.",
            "Keep test cwd repo-local and explicit.",
          ],
          knownLimits: [
            "Rejects non-test command families.",
            "Does not install dependencies or fetch network fixtures.",
          ],
          exampleInvocations: [
            {
              exampleId: "test.run.node-smoke",
              capabilityKey,
              operation: "run",
              input: {
                command: "node",
                args: ["--version"],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or disable capability key",
          deprecateStrategy: "freeze new test dispatch before removal",
          cleanupStrategy: "drain in-flight runs before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "skill.doc.generate": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:skill.doc.generate:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Repo-local documentation generator for bootstrap TMA.",
          tags: ["tap", "bootstrap", "docs", "skill"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.skill.doc.generate",
          runtimeKind: "local-tooling",
          documentFormats: ["markdown", "text"],
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:skill.doc.generate",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Repo-local documentation generator for bootstrap TMA.",
          dependencies: ["docs.read", "repo.write"],
          tags: ["tap", "bootstrap", "docs", "skill"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.skill.doc.generate",
          runtimeKind: "local-tooling",
          supports: ["generate_markdown", "generate_text"],
          prepare: { ref: "adapter.prepare:skill.doc.generate" },
          execute: { ref: "adapter.execute:skill.doc.generate" },
          cancel: { ref: "adapter.cancel:skill.doc.generate" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["write", "mkdir", "skill.doc.generate"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["write", "mkdir", "skill.doc.generate"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_doc_only", "markdown_or_text_only"],
          humanGateRequirements: ["workspace_outside_doc_generation_requires_escalation"],
        },
        builder: {
          builderId: "builder.skill.doc.generate",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:skill.doc.generate",
          healthEntry: "health:skill.doc.generate",
          successCriteria: [
            "document stays inside workspace",
            "generated content is written in the requested format",
          ],
          failureSignals: [
            "document path escapes workspace",
            "document payload missing content",
            "unsupported document extension",
          ],
          evidenceOutput: ["generated-document", "write-report"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          skillRef: "skill-creator",
          bestPractices: [
            "Generate explicit repo-local docs instead of vague placeholders.",
            "Prefer Markdown for reusable capability or skill notes.",
          ],
          knownLimits: [
            "Only writes markdown or text files inside the workspace root.",
            "Does not publish or sync documentation outside the repo.",
          ],
          exampleInvocations: [
            {
              exampleId: "skill.doc.generate.bootstrap-outline",
              capabilityKey,
              operation: "generate_markdown",
              input: {
                path: "docs/ability/bootstrap-skill-outline.md",
                title: "Bootstrap Skill Outline",
                summary: "Baseline notes for the bootstrap tooling lane.",
                sections: [
                  {
                    heading: "Capabilities",
                    body: [
                      "repo.write",
                      "shell.restricted",
                      "test.run",
                      "skill.doc.generate",
                    ],
                  },
                ],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or revert generated docs",
          deprecateStrategy: "freeze new doc generation before removal",
          cleanupStrategy: "drain in-flight doc generation before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
  }
}

export function createTapToolingBaselineCapabilityPackages(): CapabilityPackage[] {
  return TAP_TOOLING_BASELINE_CAPABILITY_KEYS.map((capabilityKey) =>
    createTapToolingCapabilityPackage(capabilityKey)
  );
}
