import type {
  CoreCmpContextPackageV1,
  CoreMpRoutedPackageV1,
  CoreContextualTextBlock,
  CoreContextualUserV1,
} from "./types.js";

function createBlock(heading: string, body?: string): CoreContextualTextBlock | undefined {
  const text = body?.trim();
  if (!text) {
    return undefined;
  }
  return { heading, body: text };
}

export function renderCoreCmpContextPackageV1(input: CoreCmpContextPackageV1): string {
  const sections = [
    `schema_version: ${input.schemaVersion}`,
    `delivery_status: ${input.deliveryStatus}`,
    input.identity
      ? [
        "identity:",
        input.identity.packageId ? `- package_id: ${input.identity.packageId}` : undefined,
        input.identity.packageRef ? `- package_ref: ${input.identity.packageRef}` : undefined,
        input.identity.packageKind ? `- package_kind: ${input.identity.packageKind}` : undefined,
        input.identity.packageMode ? `- package_mode: ${input.identity.packageMode}` : undefined,
        input.identity.projectionId ? `- projection_id: ${input.identity.projectionId}` : undefined,
        input.identity.snapshotId ? `- snapshot_id: ${input.identity.snapshotId}` : undefined,
      ].filter((line): line is string => Boolean(line)).join("\n")
      : undefined,
    input.objective
      ? [
        "objective:",
        input.objective.taskSummary ? `- task_summary: ${input.objective.taskSummary}` : undefined,
        input.objective.currentObjective ? `- current_objective: ${input.objective.currentObjective}` : undefined,
        input.objective.requestedAction ? `- requested_action: ${input.objective.requestedAction}` : undefined,
      ].filter((line): line is string => Boolean(line)).join("\n")
      : undefined,
    input.payload
      ? [
        "payload:",
        input.payload.primaryContext ? `- primary_context: ${input.payload.primaryContext}` : undefined,
        input.payload.backgroundContext ? `- background_context: ${input.payload.backgroundContext}` : undefined,
        input.payload.timelineSummary ? `- timeline_summary: ${input.payload.timelineSummary}` : undefined,
        input.payload.constraints?.length ? `- constraints: ${input.payload.constraints.join(" | ")}` : undefined,
        input.payload.risks?.length ? `- risks: ${input.payload.risks.join(" | ")}` : undefined,
        input.payload.sourceAnchorRefs?.length ? `- source_anchor_refs: ${input.payload.sourceAnchorRefs.join(" | ")}` : undefined,
      ].filter((line): line is string => Boolean(line)).join("\n")
      : undefined,
    input.governance
      ? [
        "governance:",
        input.governance.operatorGuide ? `- operator_guide: ${input.governance.operatorGuide}` : undefined,
        input.governance.childGuide ? `- child_guide: ${input.governance.childGuide}` : undefined,
        input.governance.checkerReason ? `- checker_reason: ${input.governance.checkerReason}` : undefined,
        input.governance.routeRationale ? `- route_rationale: ${input.governance.routeRationale}` : undefined,
        input.governance.scopePolicy ? `- scope_policy: ${input.governance.scopePolicy}` : undefined,
        input.governance.confidenceLabel ? `- confidence_label: ${input.governance.confidenceLabel}` : undefined,
        input.governance.fidelityLabel ? `- fidelity_label: ${input.governance.fidelityLabel}` : undefined,
        input.governance.freshness ? `- freshness: ${input.governance.freshness}` : undefined,
      ].filter((line): line is string => Boolean(line)).join("\n")
      : undefined,
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n");
}

export function renderCoreMpRoutedPackageV1(input: CoreMpRoutedPackageV1): string {
  const sections = [
    `schema_version: ${input.schemaVersion}`,
    `delivery_status: ${input.deliveryStatus}`,
    `package_id: ${input.packageId}`,
    `source_class: ${input.sourceClass}`,
    `summary: ${input.summary}`,
    input.relevanceLabel ? `relevance_label: ${input.relevanceLabel}` : undefined,
    input.freshnessLabel ? `freshness_label: ${input.freshnessLabel}` : undefined,
    input.confidenceLabel ? `confidence_label: ${input.confidenceLabel}` : undefined,
    input.primaryMemoryRefs?.length ? `primary_memory_refs: ${input.primaryMemoryRefs.join(" | ")}` : undefined,
    input.supportingMemoryRefs?.length ? `supporting_memory_refs: ${input.supportingMemoryRefs.join(" | ")}` : undefined,
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n");
}

export function createCoreContextualBlocks(input: CoreContextualUserV1): CoreContextualTextBlock[] {
  return [
    createBlock("current_objective", input.currentObjective),
    createBlock("recent_transcript", input.recentTranscript),
    createBlock("workspace_context", input.workspaceContext),
    createBlock(
      "cmp_context_package",
      typeof input.cmpContextPackage === "string"
        ? input.cmpContextPackage
        : input.cmpContextPackage
          ? renderCoreCmpContextPackageV1(input.cmpContextPackage)
          : undefined,
    ),
    createBlock(
      "mp_routed_package",
      typeof input.mpRoutedPackage === "string"
        ? input.mpRoutedPackage
        : input.mpRoutedPackage
          ? renderCoreMpRoutedPackageV1(input.mpRoutedPackage)
          : undefined,
    ),
    createBlock("tap_capability_window", input.tapCapabilityWindow),
    createBlock("capability_history", input.capabilityHistory),
    createBlock("latest_tool_result", input.latestToolResult),
    createBlock("grounding_evidence", input.groundingEvidence),
    createBlock("task_specific_constraints", input.taskSpecificConstraints),
  ].filter((block): block is CoreContextualTextBlock => Boolean(block));
}

export function renderCoreContextualUserV1(input: CoreContextualUserV1): string {
  const blocks = createCoreContextualBlocks(input);
  const renderedBlocks = blocks.map((block) => [
    `  <${block.heading}>`,
    block.body.split("\n").map((line) => `    ${line}`).join("\n"),
    `  </${block.heading}>`,
  ].join("\n"));

  return [
    "<core_contextual_user>",
    ...renderedBlocks,
    "</core_contextual_user>",
  ].join("\n");
}
