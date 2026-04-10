import {
  createCapabilityPackage,
  createCapabilityPackageActivationSpecRef,
  type CapabilityPackage,
} from "./capability-package.js";

export const TAP_TOOLING_BASELINE_CAPABILITY_KEYS = [
  "repo.write",
  "spreadsheet.write",
  "doc.write",
  "code.edit",
  "code.patch",
  "shell.restricted",
  "shell.session",
  "test.run",
  "git.status",
  "git.diff",
  "git.commit",
  "git.push",
  "code.diff",
  "browser.playwright",
  "skill.doc.generate",
  "write_todos",
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
    case "spreadsheet.write": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:spreadsheet.write:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Write bounded spreadsheet outputs inside the workspace, including csv, tsv, and first-wave single-sheet xlsx generation.",
          tags: ["tap", "bootstrap", "spreadsheet", "write"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.spreadsheet.write",
          runtimeKind: "local-tooling",
          documentFormats: ["csv", "tsv", "xlsx"],
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:spreadsheet.write",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Write bounded spreadsheet outputs inside the workspace, including csv, tsv, and first-wave single-sheet xlsx generation.",
          dependencies: ["repo.write", "spreadsheet.read"],
          tags: ["tap", "bootstrap", "spreadsheet", "write"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.spreadsheet.write",
          runtimeKind: "local-tooling",
          supports: ["write_spreadsheet"],
          prepare: { ref: "adapter.prepare:spreadsheet.write" },
          execute: { ref: "adapter.execute:spreadsheet.write" },
          cancel: { ref: "adapter.cancel:spreadsheet.write" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage", "verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["write", "mkdir", "spreadsheet.write"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["write", "mkdir", "spreadsheet.write"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_spreadsheet_only", "single_sheet_xlsx_v1"],
          humanGateRequirements: ["workspace_outside_spreadsheet_write_requires_escalation"],
        },
        builder: {
          builderId: "builder.spreadsheet.write",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:spreadsheet.write",
          healthEntry: "health:spreadsheet.write",
          successCriteria: [
            "csv/tsv outputs can be written directly inside the workspace",
            "xlsx output can be generated as a bounded single-sheet workbook",
          ],
          failureSignals: [
            "output path escapes workspace",
            "rows payload missing or invalid",
            "xlsx generation backend fails",
          ],
          evidenceOutput: ["written-spreadsheet", "write-report"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Keep rows and headers bounded and explicit.",
            "Prefer csv/tsv when formatting is unnecessary, and xlsx when the user explicitly wants workbook output.",
          ],
          knownLimits: [
            "First version writes one sheet only for xlsx output.",
            "This capability creates or overwrites outputs; it does not yet patch existing workbook formatting in place.",
          ],
          exampleInvocations: [
            {
              exampleId: "spreadsheet.write.summary-table",
              capabilityKey,
              operation: "write_spreadsheet",
              input: {
                path: "artifacts/report.xlsx",
                headers: ["name", "value"],
                rows: [
                  ["gold", 4755.44],
                  ["silver", 31.2],
                ],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or delete generated spreadsheet outputs",
          deprecateStrategy: "freeze new spreadsheet generation before removal",
          cleanupStrategy: "drain in-flight spreadsheet writes before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "doc.write": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:doc.write:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Write bounded .docx outputs inside the workspace from structured text content.",
          tags: ["tap", "bootstrap", "doc", "write"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.doc.write",
          runtimeKind: "local-tooling",
          documentFormats: ["docx"],
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:doc.write",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Write bounded .docx outputs inside the workspace from structured text content.",
          dependencies: ["repo.write", "doc.read"],
          tags: ["tap", "bootstrap", "doc", "write"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.doc.write",
          runtimeKind: "local-tooling",
          supports: ["write_docx"],
          prepare: { ref: "adapter.prepare:doc.write" },
          execute: { ref: "adapter.execute:doc.write" },
          cancel: { ref: "adapter.cancel:doc.write" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage", "verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["write", "mkdir", "doc.write"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["write", "mkdir", "doc.write"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_doc_only", "docx_generation_v1"],
          humanGateRequirements: ["workspace_outside_doc_write_requires_escalation"],
        },
        builder: {
          builderId: "builder.doc.write",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:doc.write",
          healthEntry: "health:doc.write",
          successCriteria: [
            "docx output can be generated inside the workspace",
            "title, content, and sections are preserved as readable document text",
          ],
          failureSignals: [
            "output path escapes workspace",
            "doc payload missing title/content/sections",
            "docx conversion backend fails",
          ],
          evidenceOutput: ["written-document", "write-report"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Keep the document structure explicit with title, summary, content, and sections.",
            "Use repo-local .docx paths so later doc.read can verify the generated output.",
          ],
          knownLimits: [
            "First version generates text-first .docx output and does not preserve advanced styling or tracked changes.",
            "This capability creates or overwrites the target document rather than patching existing OOXML structure.",
          ],
          exampleInvocations: [
            {
              exampleId: "doc.write.status-note",
              capabilityKey,
              operation: "write_docx",
              input: {
                path: "artifacts/status-note.docx",
                title: "Status Note",
                summary: "Current gold-price verification result.",
                sections: [
                  {
                    heading: "Observation",
                    body: ["Current price: 4755.44 USD/oz", "Observed at: 08:48:38"],
                  },
                ],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or delete generated docx outputs",
          deprecateStrategy: "freeze new document generation before removal",
          cleanupStrategy: "drain in-flight doc writes before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "code.edit": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:code.edit:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Repo-local exact text replacement tool aligned with official CLI edit semantics.",
          tags: ["tap", "bootstrap", "code", "edit"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.code.edit",
          runtimeKind: "local-tooling",
          editMode: "exact-text-replacement",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:code.edit",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Repo-local exact text replacement tool aligned with official CLI edit semantics.",
          dependencies: ["code.read", "repo.write"],
          tags: ["tap", "bootstrap", "code", "edit"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.code.edit",
          runtimeKind: "local-tooling",
          supports: ["edit_text"],
          prepare: { ref: "adapter.prepare:code.edit" },
          execute: { ref: "adapter.execute:code.edit" },
          cancel: { ref: "adapter.cancel:code.edit" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "write", "mkdir", "code.edit"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["read", "write", "mkdir", "code.edit"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_write_only", "exact_text_replacement_only"],
          humanGateRequirements: ["workspace_outside_edit_requires_escalation"],
        },
        builder: {
          builderId: "builder.code.edit",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:code.edit",
          healthEntry: "health:code.edit",
          successCriteria: ["exact text replacement applies inside workspace", "new files can be created with empty old_string"],
          failureSignals: ["old_string does not match", "path escapes workspace", "ambiguous multi-match replacement"],
          evidenceOutput: ["changed-files", "edit-report"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Read the file first and include enough surrounding context in old_string.",
            "Use allow_multiple only when every exact occurrence should change.",
          ],
          knownLimits: [
            "Only edits repo-local text files inside the workspace root.",
            "Requires exact text matching after normalizing line endings.",
          ],
          exampleInvocations: [
            {
              exampleId: "code.edit.rename-symbol",
              capabilityKey,
              operation: "edit_text",
              input: {
                path: "src/example.ts",
                old_string: "const answer = 41;",
                new_string: "const answer = 42;",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or revert repo diff",
          deprecateStrategy: "freeze new edit dispatch before removal",
          cleanupStrategy: "drain in-flight edits before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "code.patch": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:code.patch:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Repo-local patch applicator aligned with Codex-style apply_patch semantics.",
          tags: ["tap", "bootstrap", "code", "patch"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.code.patch",
          runtimeKind: "local-tooling",
          patchMode: "codex-apply-patch-style",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:code.patch",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Repo-local patch applicator aligned with Codex-style apply_patch semantics.",
          dependencies: ["code.read", "repo.write"],
          tags: ["tap", "bootstrap", "code", "patch"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.code.patch",
          runtimeKind: "local-tooling",
          supports: ["apply_patch"],
          prepare: { ref: "adapter.prepare:code.patch" },
          execute: { ref: "adapter.execute:code.patch" },
          cancel: { ref: "adapter.cancel:code.patch" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "write", "delete", "mkdir", "code.patch"]),
          },
          recommendedMode: "permissive",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["read", "write", "delete", "mkdir", "code.patch"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_write_only", "structured_patch_only"],
          humanGateRequirements: ["workspace_outside_patch_requires_escalation"],
        },
        builder: {
          builderId: "builder.code.patch",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:code.patch",
          healthEntry: "health:code.patch",
          successCriteria: ["structured patch applies inside workspace", "add/update/delete operations report changed files"],
          failureSignals: ["patch grammar invalid", "patch target escapes workspace", "patch hunk context mismatch"],
          evidenceOutput: ["changed-files", "patch-report"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Use Codex-style apply_patch envelopes with explicit file operations.",
            "Keep hunks small and include enough surrounding context for unique matches.",
          ],
          knownLimits: [
            "Only accepts structured patch text, not arbitrary shell patch pipelines.",
            "Applies changes only inside the workspace root.",
          ],
          exampleInvocations: [
            {
              exampleId: "code.patch.add-file",
              capabilityKey,
              operation: "apply_patch",
              input: {
                patch: "*** Begin Patch\n*** Add File: notes/example.txt\n+hello\n*** End Patch\n",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or revert repo diff",
          deprecateStrategy: "freeze new patch dispatch before removal",
          cleanupStrategy: "drain in-flight patch applications before replacement",
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
    case "shell.session": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:shell.session:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Stateful workspace shell session for bounded start, poll, stdin write, and terminate flows.",
          tags: ["tap", "bootstrap", "shell", "session"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.shell.session",
          runtimeKind: "local-tooling",
          commandPolicy: "interactive-session",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:shell.session",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Stateful workspace shell session for bounded start, poll, stdin write, and terminate flows.",
          dependencies: ["code.read"],
          tags: ["tap", "bootstrap", "shell", "session"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.shell.session",
          runtimeKind: "local-tooling",
          supports: ["start", "poll", "write_stdin", "terminate"],
          prepare: { ref: "adapter.prepare:shell.session" },
          execute: { ref: "adapter.execute:shell.session" },
          cancel: { ref: "adapter.cancel:shell.session" },
          resultMapping: {
            successStatuses: ["success", "partial", "timeout"],
            artifactKinds: ["verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["exec", "shell.session"]),
          },
          recommendedMode: "standard",
          riskLevel: "risky",
          defaultScope: createWorkspaceScope(["exec", "shell.session"]),
          reviewRequirements: ["allow_with_constraints"],
          safetyFlags: ["bounded_shell_session", "workspace_cwd_only", "deny_sudo_and_destructive_patterns"],
          humanGateRequirements: ["long_running_or_broad_side_effects_require_human_gate"],
        },
        builder: {
          builderId: "builder.shell.session",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:shell.session",
          healthEntry: "health:shell.session",
          successCriteria: ["session can start in workspace", "poll and stdin writes return bounded output", "terminate closes the session cleanly"],
          failureSignals: ["command policy violation", "cwd escapes workspace", "session id missing or stale"],
          evidenceOutput: ["session-id", "stdout", "stderr", "exit-code"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Prefer shell.restricted for one-shot commands and shell.session only for genuine interactive flows.",
            "Poll with bounded yield_time_ms and max output rather than dumping huge scrollback.",
          ],
          knownLimits: [
            "First version uses plain pipes rather than a full PTY UI surface.",
            "Session state is process-local to the current Praxis runtime.",
          ],
          exampleInvocations: [
            {
              exampleId: "shell.session.start-python",
              capabilityKey,
              operation: "start",
              input: {
                command: "python3",
                args: ["-i"],
                cwd: ".",
                yield_time_ms: 500,
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or clear live session registry",
          deprecateStrategy: "freeze new session starts before removal",
          cleanupStrategy: "terminate lingering sessions before replacement",
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
    case "git.status": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:git.status:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Bounded git working-tree status for the current workspace.",
          tags: ["tap", "bootstrap", "git", "status"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.git.status",
          runtimeKind: "local-tooling",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:git.status",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Bounded git working-tree status for the current workspace.",
          dependencies: ["code.read"],
          tags: ["tap", "bootstrap", "git", "status"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.git.status",
          runtimeKind: "local-tooling",
          supports: ["status"],
          prepare: { ref: "adapter.prepare:git.status" },
          execute: { ref: "adapter.execute:git.status" },
          cancel: { ref: "adapter.cancel:git.status" },
          resultMapping: {
            successStatuses: ["success", "partial"],
            artifactKinds: ["verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "exec", "git.status"]),
          },
          recommendedMode: "standard",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["read", "exec", "git.status"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["read_only_git_status", "workspace_git_only"],
          humanGateRequirements: [],
        },
        builder: {
          builderId: "builder.git.status",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:git.status",
          healthEntry: "health:git.status",
          successCriteria: ["git status executes inside workspace", "branch and file status are returned in bounded form"],
          failureSignals: ["not a git repository", "cwd escapes workspace", "git command failure"],
          evidenceOutput: ["branch", "status-entries", "status-text"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Use git.status for repo state rather than dumping raw shell output.",
            "Keep pathspec filters narrow on large repos.",
          ],
          knownLimits: [
            "Only reports repository state; it does not stage or mutate files.",
            "Requires the target cwd to be inside a git worktree.",
          ],
          exampleInvocations: [
            {
              exampleId: "git.status.workspace",
              capabilityKey,
              operation: "status",
              input: {
                cwd: ".",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or disable capability key",
          deprecateStrategy: "freeze new git status dispatch before removal",
          cleanupStrategy: "drain in-flight git status calls before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "git.diff": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:git.diff:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Bounded git diff view for the current workspace or a selected revision range.",
          tags: ["tap", "bootstrap", "git", "diff"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.git.diff",
          runtimeKind: "local-tooling",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:git.diff",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Bounded git diff view for the current workspace or a selected revision range.",
          dependencies: ["code.read", "git.status"],
          tags: ["tap", "bootstrap", "git", "diff"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.git.diff",
          runtimeKind: "local-tooling",
          supports: ["diff"],
          prepare: { ref: "adapter.prepare:git.diff" },
          execute: { ref: "adapter.execute:git.diff" },
          cancel: { ref: "adapter.cancel:git.diff" },
          resultMapping: {
            successStatuses: ["success", "partial"],
            artifactKinds: ["verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "exec", "git.diff"]),
          },
          recommendedMode: "standard",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["read", "exec", "git.diff"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["read_only_git_diff", "workspace_git_only"],
          humanGateRequirements: [],
        },
        builder: {
          builderId: "builder.git.diff",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:git.diff",
          healthEntry: "health:git.diff",
          successCriteria: ["git diff executes inside workspace", "diff text is bounded and accompanied by a small summary"],
          failureSignals: ["not a git repository", "cwd escapes workspace", "git diff failure"],
          evidenceOutput: ["diff", "diff-stat", "file-list"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Prefer staged or path-filtered diffs over full-repo dumps on large changesets.",
            "Use git.status first when you need a quick summary of what changed.",
          ],
          knownLimits: [
            "Read-only capability; it does not stage, commit, or push.",
            "Large diffs are truncated to keep context bounded.",
          ],
          exampleInvocations: [
            {
              exampleId: "git.diff.working-tree",
              capabilityKey,
              operation: "diff",
              input: {
                cwd: ".",
                staged: false,
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or disable capability key",
          deprecateStrategy: "freeze new git diff dispatch before removal",
          cleanupStrategy: "drain in-flight git diff calls before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "git.commit": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:git.commit:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Create a new git commit from explicitly staged workspace paths with official CLI style safety guards.",
          tags: ["tap", "bootstrap", "git", "commit"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.git.commit",
          runtimeKind: "local-tooling",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:git.commit",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Create a new git commit from explicitly staged workspace paths with official CLI style safety guards.",
          dependencies: ["git.status", "git.diff"],
          tags: ["tap", "bootstrap", "git", "commit"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.git.commit",
          runtimeKind: "local-tooling",
          supports: ["commit"],
          prepare: { ref: "adapter.prepare:git.commit" },
          execute: { ref: "adapter.execute:git.commit" },
          cancel: { ref: "adapter.cancel:git.commit" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["verification", "usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "write", "exec", "git.commit"]),
          },
          recommendedMode: "standard",
          riskLevel: "risky",
          defaultScope: createWorkspaceScope(["read", "write", "exec", "git.commit"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_git_only", "no_amend", "no_no_verify", "secret_path_guard"],
          humanGateRequirements: ["shared_or_remote_git_side_effects_require_review"],
        },
        builder: {
          builderId: "builder.git.commit",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:git.commit",
          healthEntry: "health:git.commit",
          successCriteria: ["git commit creates a new commit hash", "no-op or unsafe commit requests are rejected cleanly"],
          failureSignals: ["empty commit attempt", "amend requested", "secret-like paths included", "cwd escapes workspace"],
          evidenceOutput: ["commit-hash", "committed-files", "commit-summary"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Pass explicit paths whenever possible so unrelated dirty files do not get swept into the commit.",
            "Create new commits instead of amending unless the user explicitly requests amend elsewhere.",
          ],
          knownLimits: [
            "Rejects --amend and --no-verify style behavior.",
            "Will block obvious secret-like paths such as .env or credentials files.",
          ],
          exampleInvocations: [
            {
              exampleId: "git.commit.explicit-paths",
              capabilityKey,
              operation: "commit",
              input: {
                cwd: ".",
                paths: ["src/agent_core/live-agent-chat.ts"],
                message: "Add direct CLI capability guidance",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or revert the created commit explicitly if requested",
          deprecateStrategy: "freeze new git commit dispatch before removal",
          cleanupStrategy: "drain in-flight git commit calls before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "git.push": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:git.push:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Push the current branch to a remote with normal non-force git semantics.",
          tags: ["tap", "bootstrap", "git", "push"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.git.push",
          runtimeKind: "local-tooling",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:git.push",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Push the current branch to a remote with normal non-force git semantics.",
          dependencies: ["git.commit"],
          tags: ["tap", "bootstrap", "git", "push"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.git.push",
          runtimeKind: "local-tooling",
          supports: ["push"],
          prepare: { ref: "adapter.prepare:git.push" },
          execute: { ref: "adapter.execute:git.push" },
          cancel: { ref: "adapter.cancel:git.push" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["verification", "usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "write", "exec", "git.push"]),
          },
          recommendedMode: "standard",
          riskLevel: "risky",
          defaultScope: createWorkspaceScope(["read", "write", "exec", "git.push"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["workspace_git_only", "no_force_push", "remote_side_effect"],
          humanGateRequirements: ["shared_or_remote_git_side_effects_require_review"],
        },
        builder: {
          builderId: "builder.git.push",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: true,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:git.push",
          healthEntry: "health:git.push",
          successCriteria: ["git push succeeds without force flags", "remote and branch are reported back in bounded form"],
          failureSignals: ["force push requested", "remote missing", "push rejected by remote"],
          evidenceOutput: ["remote", "branch", "push-output"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Prefer explicit remote and branch names when the current branch may be ambiguous.",
            "Use normal push semantics only; escalation for force push should live elsewhere.",
          ],
          knownLimits: [
            "Rejects force and force-with-lease requests.",
            "Pushing affects shared remote state and should stay visible in the activity log.",
          ],
          exampleInvocations: [
            {
              exampleId: "git.push.origin-head",
              capabilityKey,
              operation: "push",
              input: {
                cwd: ".",
                remote: "origin",
                branch: "integrate/dev-master-cmp",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding; any remote rollback remains explicit git work",
          deprecateStrategy: "freeze new git push dispatch before removal",
          cleanupStrategy: "drain in-flight git push calls before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "code.diff": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:code.diff:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Generate a bounded unified diff between two code snapshots or files.",
          tags: ["tap", "bootstrap", "code", "diff"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.code.diff",
          runtimeKind: "local-tooling",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:code.diff",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Generate a bounded unified diff between two code snapshots or files.",
          dependencies: ["code.read"],
          tags: ["tap", "bootstrap", "code", "diff"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.code.diff",
          runtimeKind: "local-tooling",
          supports: ["diff"],
          prepare: { ref: "adapter.prepare:code.diff" },
          execute: { ref: "adapter.execute:code.diff" },
          cancel: { ref: "adapter.cancel:code.diff" },
          resultMapping: {
            successStatuses: ["success", "partial"],
            artifactKinds: ["verification"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "exec", "code.diff"]),
          },
          recommendedMode: "standard",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["read", "exec", "code.diff"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["read_only_diff", "bounded_output"],
          humanGateRequirements: [],
        },
        builder: {
          builderId: "builder.code.diff",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:code.diff",
          healthEntry: "health:code.diff",
          successCriteria: ["diff text returns in unified format", "string or file comparisons stay bounded"],
          failureSignals: ["missing left or right input", "path escapes workspace", "diff tool failure"],
          evidenceOutput: ["diff"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Use code.diff for bounded local comparisons rather than asking the model to eyeball raw blobs.",
            "Prefer comparing explicit file paths or exact before/after text.",
          ],
          knownLimits: [
            "Diff output is truncated when too large.",
            "Does not mutate files or git state.",
          ],
          exampleInvocations: [
            {
              exampleId: "code.diff.two-files",
              capabilityKey,
              operation: "diff",
              input: {
                leftPath: "src/old.ts",
                rightPath: "src/new.ts",
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or disable capability key",
          deprecateStrategy: "freeze new code diff dispatch before removal",
          cleanupStrategy: "drain in-flight code diff calls before replacement",
          generationPolicy: "create_next_generation",
        },
        activationSpec,
        replayPolicy: "re_review_then_dispatch",
        metadata: {
          packageKind: "tap-tooling-baseline",
        },
      });
    }
    case "browser.playwright": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:browser.playwright:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Local browser automation capability that adapts Codex, Claude Code, and Gemini CLI browser semantics onto a shared Playwright MCP substrate.",
          tags: ["tap", "bootstrap", "browser", "playwright"],
          routeHints: [
            { key: "runtime", value: "local-tooling" },
            { key: "toolKind", value: "browser-automation" },
          ],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.browser.playwright",
          runtimeKind: "local-tooling",
          browserRuntime: "playwright-mcp-shared",
          workspaceScope: "workspace-only",
        },
        adapterFactoryRef: "factory:tap-tooling:browser.playwright",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B1",
          version: "1.0.0",
          generation: 1,
          description: "Local browser automation capability that adapts Codex, Claude Code, and Gemini CLI browser semantics onto a shared Playwright MCP substrate.",
          dependencies: [],
          tags: ["tap", "bootstrap", "browser", "playwright"],
          routeHints: [
            { key: "runtime", value: "local-tooling" },
            { key: "toolKind", value: "browser-automation" },
          ],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.browser.playwright",
          runtimeKind: "local-tooling",
          supports: ["connect", "list_tools", "browser_call", "disconnect"],
          prepare: { ref: "adapter.prepare:browser.playwright" },
          execute: { ref: "adapter.execute:browser.playwright" },
          cancel: { ref: "adapter.cancel:browser.playwright" },
          resultMapping: {
            successStatuses: ["success", "partial"],
            artifactKinds: ["verification", "usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B1",
            mode: "balanced",
            scope: createWorkspaceScope(["read", "exec", "browser.playwright"]),
          },
          recommendedMode: "standard",
          riskLevel: "risky",
          defaultScope: createWorkspaceScope(["read", "exec", "browser.playwright"]),
          reviewRequirements: ["allow"],
          safetyFlags: [
            "browser_automation_side_effects",
            "allowed_domains_optional_guard",
            "file_upload_blocked_by_default",
          ],
          humanGateRequirements: ["browser_navigation_or_form_actions_require_review"],
        },
        builder: {
          builderId: "builder.browser.playwright",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: true,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:browser.playwright",
          healthEntry: "health:browser.playwright",
          successCriteria: [
            "browser session can connect and list browser_* tools",
            "navigate and snapshot flows stay bounded and structured",
          ],
          failureSignals: [
            "playwright MCP launch fails",
            "blocked domain navigation requested",
            "file upload attempted without explicit opt-in",
          ],
          evidenceOutput: ["browser-tool-result", "browser-tool-text", "browser-tool-images"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Prefer bounded actions like navigate, snapshot, screenshot, click, type, and wait_for over arbitrary raw tool calls.",
            "Pass allowedDomains when the task should stay inside a known site or product surface.",
          ],
          knownLimits: [
            "Uses a shared local Playwright MCP substrate even when the selected behavior style follows Codex, Claude Code, or Gemini CLI semantics.",
            "File uploads stay blocked unless allowFileUploads=true is passed explicitly.",
          ],
          exampleInvocations: [
            {
              exampleId: "browser.playwright.navigate-example",
              capabilityKey,
              operation: "navigate",
              input: {
                action: "navigate",
                url: "https://example.com",
                headless: true,
                allowedDomains: ["example.com"],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or disconnect browser session",
          deprecateStrategy: "freeze new browser automation dispatch before removal",
          cleanupStrategy: "drain in-flight browser sessions before replacement",
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
    case "write_todos": {
      const activationSpec = {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify" as const,
        registerOrReplace: "register_or_replace" as const,
        generationStrategy: "create_next_generation" as const,
        drainStrategy: "graceful" as const,
        manifestPayload: {
          capabilityKey,
          capabilityId: "capability:write_todos:1",
          version: "1.0.0",
          generation: 1,
          kind: "tool",
          description: "Manage the current session todo list in a structured, bounded form.",
          tags: ["tap", "bootstrap", "todos", "tracker"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        bindingPayload: {
          adapterId: "adapter.write_todos",
          runtimeKind: "local-tooling",
          sessionScope: "session-only",
        },
        adapterFactoryRef: "factory:tap-tooling:write_todos",
      };

      return createCapabilityPackage({
        manifest: {
          capabilityKey,
          capabilityKind: "tool",
          tier: "B0",
          version: "1.0.0",
          generation: 1,
          description: "Manage the current session todo list in a structured, bounded form.",
          dependencies: [],
          tags: ["tap", "bootstrap", "todos", "tracker"],
          routeHints: [{ key: "runtime", value: "local-tooling" }],
          supportedPlatforms: ["linux", "macos", "windows"],
          metadata: {
            baselineFamily: "tap-bootstrap-tma",
            formalPackage: true,
          },
        },
        adapter: {
          adapterId: "adapter.write_todos",
          runtimeKind: "local-tooling",
          supports: ["set_todos"],
          prepare: { ref: "adapter.prepare:write_todos" },
          execute: { ref: "adapter.execute:write_todos" },
          cancel: { ref: "adapter.cancel:write_todos" },
          resultMapping: {
            successStatuses: ["success"],
            artifactKinds: ["usage"],
          },
        },
        policy: {
          defaultBaseline: {
            grantedTier: "B0",
            mode: "balanced",
            scope: createWorkspaceScope(["write_todos"]),
          },
          recommendedMode: "standard",
          riskLevel: "normal",
          defaultScope: createWorkspaceScope(["write_todos"]),
          reviewRequirements: ["allow"],
          safetyFlags: ["session_state_only"],
          humanGateRequirements: [],
        },
        builder: {
          builderId: "builder.write_todos",
          buildStrategy: "builtin-bootstrap-tooling",
          requiresNetwork: false,
          requiresInstall: false,
          requiresSystemWrite: false,
          allowedWorkdirScope: ["workspace/**"],
          activationSpecRef: createCapabilityPackageActivationSpecRef(activationSpec),
          replayCapability: "re_review_then_dispatch",
        },
        verification: {
          smokeEntry: "smoke:write_todos",
          healthEntry: "health:write_todos",
          successCriteria: ["todo list can be set and cleared per session", "at most one in_progress todo is accepted"],
          failureSignals: ["invalid todo schema", "multiple in_progress items"],
          evidenceOutput: ["old-todos", "new-todos"],
        },
        usage: {
          usageDocRef: "docs/ability/25-tap-capability-package-template.md",
          bestPractices: [
            "Keep todos short, concrete, and current.",
            "Only mark one item as in_progress at a time.",
          ],
          knownLimits: [
            "Session-local state only; first version is not yet a durable memory system.",
            "This capability manages checklist state, not arbitrary notes.",
          ],
          exampleInvocations: [
            {
              exampleId: "write_todos.basic",
              capabilityKey,
              operation: "set_todos",
              input: {
                todos: [
                  { description: "Implement shell.session", status: "in_progress" },
                  { description: "Add targeted tests", status: "pending" },
                ],
              },
            },
          ],
        },
        lifecycle: {
          installStrategy: "built-in bootstrap registration",
          replaceStrategy: "register_or_replace",
          rollbackStrategy: "restore prior binding or clear session todo state",
          deprecateStrategy: "freeze new todo updates before removal",
          cleanupStrategy: "drain in-flight todo updates before replacement",
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
