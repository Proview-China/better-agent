import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ReadStream } from "node:tty";

import type {
  CmpPanelSnapshotPayload,
  CmpTurnArtifacts,
  CoreTurnArtifacts,
  DirectFallbackReader,
  LiveCliState,
  LiveCliRuntime,
  MpPanelSnapshotPayload,
} from "./shared.js";
import {
  formatDisplayValue,
  formatLiveStatus,
  formatRoutePlan,
  formatTapMatrixRows,
  formatTranscript,
  LIVE_CHAT_MODEL_PLAN,
  LIVE_CHAT_PERMISSIONS_CONFIG,
  LIVE_CHAT_TAP_OVERRIDE,
  LIVE_CHAT_UI_CONFIG,
  truncate,
} from "./shared.js";
import {
  DEFAULT_PRAXIS_SLASH_COMMANDS,
  formatSlashDisplayText,
} from "../tui-input/slash-engine.js";
import { resolveConfiguredWorkspaceRoot } from "../../raxcode-config.js";

function printDivider(label?: string): void {
  const prefix = "\n============================================================";
  if (!label) {
    console.log(prefix);
    return;
  }
  console.log(`${prefix}\n${label}\n============================================================`);
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width, " ");
}

function wrapComposerLine(line: string, width: number): string[] {
  if (!line) {
    return [""];
  }
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    chunks.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  chunks.push(remaining);
  return chunks;
}

function buildComposerFrame(buffer: string): string[] {
  const maxWidth = Math.min(process.stdout.columns ?? 72, 88);
  const innerWidth = Math.max(38, Math.min(maxWidth - 2, 72));
  const bodyWidth = innerWidth - 3;
  const rawLines = buffer.split("\n");
  const wrapped = rawLines.flatMap((line) => wrapComposerLine(line, bodyWidth));
  const visible = wrapped.length > 0 ? wrapped.slice(-4) : [""];
  const lastIndex = visible.length - 1;
  visible[lastIndex] = `${visible[lastIndex]}▌`;
  const paddedBody = visible.map((line) => `│ ${padRight(line, innerWidth - 1)}│`);
  while (paddedBody.length < 4) {
    paddedBody.push(`│ ${padRight("", innerWidth - 1)}│`);
  }

  return [
    `╭${"─".repeat(innerWidth)}╮`,
    `│ ${padRight("Compose", innerWidth - 1)}│`,
    ...paddedBody,
    `╰${"─".repeat(innerWidth)}╯`,
    "  Enter send · Ctrl+J newline · /exit quit",
  ];
}

function printDirectBox(title: string, lines: string[]): void {
  const maxWidth = Math.min(process.stdout.columns ?? 72, 88);
  const wrapWidth = Math.max(36, Math.min(maxWidth - 3, 82));
  const wrappedLines = lines.flatMap((line) => wrapComposerLine(line, wrapWidth));
  const innerWidth = Math.max(
    38,
    Math.min(
      maxWidth - 2,
      Math.max(title.length, ...wrappedLines.map((line) => line.length), 38) + 2,
    ),
  );
  console.log(`╭${"─".repeat(innerWidth)}╮`);
  console.log(`│ ${padRight(title, innerWidth - 1)}│`);
  if (wrappedLines.length > 0) {
    console.log(`│ ${padRight("", innerWidth - 1)}│`);
  }
  for (const line of wrappedLines) {
    console.log(`│ ${padRight(line, innerWidth - 1)}│`);
  }
  console.log(`╰${"─".repeat(innerWidth)}╯`);
}

function formatSlashCommandHelpLines(): string[] {
  const maxLabelWidth = DEFAULT_PRAXIS_SLASH_COMMANDS.reduce(
    (max, command) => Math.max(max, formatSlashDisplayText(command).length),
    0,
  );
  const builtInLines = DEFAULT_PRAXIS_SLASH_COMMANDS.map((command, index) =>
    `${String(index + 1).padStart(2, "0")} ${formatSlashDisplayText(command).padEnd(maxLabelWidth, " ")}  ${command.description ?? ""}`.trimEnd());
  return [
    ...builtInLines,
    `${String(builtInLines.length + 1).padStart(2, "0")} /rewind <turn>`.padEnd(maxLabelWidth + 5, " ") + "  rewind the in-memory conversation to a prior turn",
  ];
}

export function printDirectBullet(text: string): void {
  console.log(`• ${text}`);
}

export function printDirectSub(text: string): void {
  console.log(`  ↳ ${text}`);
}

export async function promptDirectInputBox(): Promise<string | null> {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const ttyInput = input as ReadStream;
  const originalRawMode = ttyInput.isRaw;
  let buffer = "";
  let renderedLines = 0;

  const render = () => {
    const frame = buildComposerFrame(buffer);
    if (renderedLines > 0) {
      output.write(`\x1b[${renderedLines}F`);
      for (let index = 0; index < renderedLines; index += 1) {
        output.write("\x1b[2K");
        if (index < renderedLines - 1) {
          output.write("\x1b[1E");
        }
      }
      output.write(`\x1b[${renderedLines}F`);
    }
    output.write(`\n${frame.join("\n")}\n`);
    renderedLines = frame.length + 1;
  };

  const clear = () => {
    if (renderedLines === 0) {
      return;
    }
    output.write(`\x1b[${renderedLines}F`);
    for (let index = 0; index < renderedLines; index += 1) {
      output.write("\x1b[2K");
      if (index < renderedLines - 1) {
        output.write("\x1b[1E");
      }
    }
    output.write(`\x1b[${renderedLines}F`);
    renderedLines = 0;
  };

  render();

  return await new Promise<string | null>((resolvePrompt) => {
    const onData = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");

      if (text === "\u0003") {
        cleanup();
        resolvePrompt(null);
        return;
      }
      if (text === "\r") {
        const submitted = buffer;
        cleanup();
        resolvePrompt(submitted);
        return;
      }
      if (text === "\n") {
        buffer += "\n";
        render();
        return;
      }
      if (text === "\u007f" || text === "\b") {
        buffer = buffer.slice(0, -1);
        render();
        return;
      }
      if (text === "\u001b") {
        return;
      }

      buffer += text;
      render();
    };

    const cleanup = () => {
      ttyInput.off("data", onData);
      if (!originalRawMode) {
        ttyInput.setRawMode(false);
      }
      clear();
    };

    ttyInput.setRawMode(true);
    ttyInput.resume();
    ttyInput.on("data", onData);
  });
}

export async function readDirectFallbackLine(
  reader: DirectFallbackReader,
): Promise<string | null> {
  return reader.read();
}

export function printStartup(config: { baseURL: string }): void {
  printDivider("Praxis Live CLI");
  console.log("当前这不是假 mock，而是 CMP + TAP + core 的真实运行 harness。");
  console.log(`OpenAI-compatible route: ${config.baseURL}`);
  console.log(formatRoutePlan("core", LIVE_CHAT_MODEL_PLAN.core));
  console.log("TAP:");
  console.log(`  ${formatRoutePlan("reviewer", LIVE_CHAT_MODEL_PLAN.tap.reviewer)}`);
  console.log(`  ${formatRoutePlan("tool_reviewer", LIVE_CHAT_MODEL_PLAN.tap.toolReviewer)}`);
  console.log(`  ${formatRoutePlan("provisioner", LIVE_CHAT_MODEL_PLAN.tap.provisioner)}`);
  console.log("CMP:");
  console.log(`  ${formatRoutePlan("icma", LIVE_CHAT_MODEL_PLAN.cmp.icma)}`);
  console.log(`  ${formatRoutePlan("iterator", LIVE_CHAT_MODEL_PLAN.cmp.iterator)}`);
  console.log(`  ${formatRoutePlan("checker", LIVE_CHAT_MODEL_PLAN.cmp.checker)}`);
  console.log(`  ${formatRoutePlan("dbagent", LIVE_CHAT_MODEL_PLAN.cmp.dbagent)}`);
  console.log(`  ${formatRoutePlan("dispatcher", LIVE_CHAT_MODEL_PLAN.cmp.dispatcher)}`);
  console.log("命令:");
  for (const line of formatSlashCommandHelpLines()) {
    console.log(`  ${line}`);
  }
}

export function printStartupDirect(config: { baseURL: string }): void {
  printDirectBox(">_ Praxis Direct CLI", [
    `model:     ${LIVE_CHAT_MODEL_PLAN.core.model} ${LIVE_CHAT_MODEL_PLAN.core.reasoning}`,
    `tap mode:  ${LIVE_CHAT_TAP_OVERRIDE.requestedMode} / ${LIVE_CHAT_TAP_OVERRIDE.automationDepth}`,
    `workspace: ${resolveConfiguredWorkspaceRoot().split("/").slice(-1)[0] || resolveConfiguredWorkspaceRoot()}`,
    `route:     ${config.baseURL}`,
  ]);
  console.log("Commands:");
  for (const line of formatSlashCommandHelpLines()) {
    console.log(`  ${line}`);
  }
  console.log("Composer: Enter send · Ctrl+J newline");
}

export function printHelp(uiMode: "full" | "direct"): void {
  const commandLines = formatSlashCommandHelpLines();
  if (uiMode === "direct") {
    console.log("");
    printDirectBox("Commands", commandLines);
    return;
  }
  printDivider("Commands");
  for (const line of commandLines) {
    console.log(line);
  }
}

export function printModelView(config: { baseURL: string }): void {
  console.log("");
  printDirectBox("Model View", [
    `core:       ${LIVE_CHAT_MODEL_PLAN.core.model} ${LIVE_CHAT_MODEL_PLAN.core.reasoning}`,
    `reviewer:   ${LIVE_CHAT_MODEL_PLAN.tap.reviewer.model} ${LIVE_CHAT_MODEL_PLAN.tap.reviewer.reasoning}`,
    `tool review:${LIVE_CHAT_MODEL_PLAN.tap.toolReviewer.model} ${LIVE_CHAT_MODEL_PLAN.tap.toolReviewer.reasoning}`,
    `provisioner:${LIVE_CHAT_MODEL_PLAN.tap.provisioner.model} ${LIVE_CHAT_MODEL_PLAN.tap.provisioner.reasoning}`,
    `cmp/icma:   ${LIVE_CHAT_MODEL_PLAN.cmp.icma.model} ${LIVE_CHAT_MODEL_PLAN.cmp.icma.reasoning}`,
    `cmp/iter:   ${LIVE_CHAT_MODEL_PLAN.cmp.iterator.model} ${LIVE_CHAT_MODEL_PLAN.cmp.iterator.reasoning}`,
    `cmp/checker:${LIVE_CHAT_MODEL_PLAN.cmp.checker.model} ${LIVE_CHAT_MODEL_PLAN.cmp.checker.reasoning}`,
    `cmp/dbagent:${LIVE_CHAT_MODEL_PLAN.cmp.dbagent.model} ${LIVE_CHAT_MODEL_PLAN.cmp.dbagent.reasoning}`,
    `cmp/dispatch:${LIVE_CHAT_MODEL_PLAN.cmp.dispatcher.model} ${LIVE_CHAT_MODEL_PLAN.cmp.dispatcher.reasoning}`,
    `mp/icma:    ${LIVE_CHAT_MODEL_PLAN.mp.icma.model} ${LIVE_CHAT_MODEL_PLAN.mp.icma.reasoning}`,
    `mp/iter:    ${LIVE_CHAT_MODEL_PLAN.mp.iterator.model} ${LIVE_CHAT_MODEL_PLAN.mp.iterator.reasoning}`,
    `mp/checker: ${LIVE_CHAT_MODEL_PLAN.mp.checker.model} ${LIVE_CHAT_MODEL_PLAN.mp.checker.reasoning}`,
    `mp/dbagent: ${LIVE_CHAT_MODEL_PLAN.mp.dbagent.model} ${LIVE_CHAT_MODEL_PLAN.mp.dbagent.reasoning}`,
    `mp/dispatch:${LIVE_CHAT_MODEL_PLAN.mp.dispatcher.model} ${LIVE_CHAT_MODEL_PLAN.mp.dispatcher.reasoning}`,
    `tui/main:   ${LIVE_CHAT_MODEL_PLAN.tui.model} ${LIVE_CHAT_MODEL_PLAN.tui.reasoning}`,
    `route:      ${config.baseURL}`,
  ]);
}

export function printMpViewPlaceholder(): void {
  console.log("");
  printDirectBox("MP View", [
    "goal: browse current memory state",
    "status: MP readback pane is not wired into the direct CLI yet",
    "next: expose memory cards and scope summaries inside the current shell",
  ]);
}

export function formatDirectMpSnapshotLines(snapshot: MpPanelSnapshotPayload): string[] {
  const lines = [
    snapshot.summaryLines[0] ?? "MP summary is not available yet.",
    snapshot.summaryLines[1] ?? "MP source detail is not available yet.",
    snapshot.summaryLines[2] ?? `${snapshot.recordCount ?? snapshot.entries.length} memory records`,
    `status=${snapshot.status} source=${snapshot.sourceKind}/${snapshot.sourceClass}`,
    snapshot.rootPath ? `rootPath=${truncate(snapshot.rootPath, 84)}` : undefined,
    ...(snapshot.detailLines ?? []).slice(0, 3),
    ...(snapshot.issueLines ?? []).slice(0, 2).map((line) => `issue: ${line}`),
    ...(snapshot.roleLines ?? []).slice(0, 5),
  ].filter((line): line is string => typeof line === "string" && line.length > 0);

  if (snapshot.entries.length === 0) {
    lines.push(snapshot.emptyReason ?? "No MP memory records are available.");
    return lines;
  }

  lines.push(`showing ${Math.min(snapshot.entries.length, 8)} of ${snapshot.entries.length} records:`);
  for (const entry of snapshot.entries.slice(0, 8)) {
    const scope = [entry.scopeLevel, entry.agentId].filter(Boolean).join(":") || "-";
    lines.push(`${entry.memoryId} · ${scope}`);
    lines.push(`  ${truncate(entry.summary || entry.label, 92)}`);
  }
  return lines;
}

export function printMpViewerSnapshot(snapshot: MpPanelSnapshotPayload): void {
  console.log("");
  printDirectBox("MP View", formatDirectMpSnapshotLines(snapshot));
}

export function printInitViewPlaceholder(): void {
  console.log("");
  printDirectBox("Init", [
    "session bootstrap already happens at startup",
    "dedicated /init flow is reserved for a richer setup surface",
  ]);
}

export function printResumeViewPlaceholder(): void {
  console.log("");
  printDirectBox("Resume", [
    "session recovery is managed by the direct TUI shell",
    "use `raxode resume <session-name-or-id>` or the TUI /resume panel",
  ]);
}

export function printAgentsViewPlaceholder(): void {
  console.log("");
  printDirectBox("Agents View", [
    "current shell is still single-agent first",
    "the /agents entry is reserved for switching into an agents-focused surface",
  ]);
}

export function printPermissionsView(runtime: LiveCliRuntime): void {
  const governance = runtime.createTapGovernanceObject({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const userSurface = runtime.createTapUserSurfaceSnapshot({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const snapshot = runtime.createTapGovernanceSnapshot();
  console.log("");
  printDirectBox("Permissions", [
    `effectiveMode: ${governance.taskPolicy.effectiveMode}`,
    `workspaceMode: ${governance.workspacePolicy.workspaceMode}`,
    `capabilityOverrides: ${LIVE_CHAT_PERMISSIONS_CONFIG.capabilityOverrides.length}`,
    `pendingHumanGateCount: ${userSurface.pendingHumanGateCount}`,
    `blockingCapabilityKeys: ${snapshot.blockingCapabilityKeys.join(", ") || "(none)"}`,
  ]);
}

export function printLanguageViewPlaceholder(): void {
  console.log("");
  printDirectBox("Language", [
    `current language: ${LIVE_CHAT_UI_CONFIG.language}`,
    "language ids remain English while shell copy follows the configured locale",
  ]);
}

export function printWorkspaceView(currentWorkspace = resolveConfiguredWorkspaceRoot()): void {
  console.log("");
  printDirectBox("Workspace", [
    `current: ${currentWorkspace}`,
    "usage: /workspace <path>",
    "switch the current workspace directory for the direct shell",
  ]);
}

export function printCmpArtifacts(turn: CmpTurnArtifacts): void {
  printDivider("CMP Active View");
  console.log(`syncStatus: ${turn.syncStatus}`);
  console.log(`agentId: ${turn.agentId}`);
  console.log(`intent: ${turn.intent}`);
  console.log(`operatorGuide: ${turn.operatorGuide}`);
  console.log(`childGuide: ${turn.childGuide}`);
  console.log(`checkerReason: ${turn.checkerReason}`);
  console.log(`packageRef: ${turn.packageRef}`);
  console.log(`routeRationale: ${turn.routeRationale}`);
  console.log(`scopePolicy: ${turn.scopePolicy}`);
  console.log(`packageStrategy: ${formatDisplayValue(turn.packageStrategy)}`);
  console.log(`timelineStrategy: ${formatDisplayValue(turn.timelineStrategy)}`);
  if (turn.failureReason) {
    console.log(`failureReason: ${turn.failureReason}`);
  }
  console.log(
    `live: icma=${formatLiveStatus(turn.summary.live.icma)}, iterator=${formatLiveStatus(turn.summary.live.iterator)}, checker=${formatLiveStatus(turn.summary.live.checker)}, dbagent=${formatLiveStatus(turn.summary.live.dbagent)}, dispatcher=${formatLiveStatus(turn.summary.live.dispatcher)}`,
  );
}

export function formatDirectCmpSnapshotLines(
  snapshot: CmpPanelSnapshotPayload,
  latestTurn?: CmpTurnArtifacts,
): string[] {
  const lines = [
    snapshot.summaryLines[0] ?? "CMP summary is not available yet.",
    snapshot.summaryLines[1] ?? "CMP lifecycle detail is not available yet.",
    snapshot.summaryLines[2] ?? `db=${snapshot.truthStatus ?? "unknown"} readback=${snapshot.readbackStatus ?? "unknown"}`,
    `status=${snapshot.status} source=${snapshot.sourceKind} truth=${snapshot.truthStatus ?? "unknown"} readback=${snapshot.readbackStatus ?? "unknown"}`,
    ...(snapshot.detailLines ?? []).slice(0, 3),
    ...(snapshot.requestLines ?? []).slice(0, 2),
    ...(snapshot.issueLines ?? []).slice(0, 2).map((line) => `issue: ${line}`),
    ...(snapshot.roleLines ?? []).slice(0, 5),
  ];

  if (snapshot.entries.length === 0) {
    lines.push(snapshot.emptyReason ?? "No CMP section records are available.");
  } else {
    lines.push(`showing ${Math.min(snapshot.entries.length, 8)} of ${snapshot.entries.length} sections:`);
    for (const entry of snapshot.entries.slice(0, 8)) {
      lines.push(`${entry.lifecycle} · ${entry.kind} · ${entry.agentId}`);
      lines.push(`  ${truncate(entry.ref, 92)}`);
    }
  }

  if (latestTurn) {
    lines.push("latest cmp turn:");
    lines.push(`  agentId=${latestTurn.agentId} packageRef=${truncate(latestTurn.packageRef, 72)}`);
    lines.push(`  route=${truncate(latestTurn.routeRationale, 72)} scope=${truncate(latestTurn.scopePolicy, 32)}`);
  }

  return lines;
}

export function printCmpViewerSnapshot(
  snapshot: CmpPanelSnapshotPayload,
  latestTurn?: CmpTurnArtifacts,
): void {
  console.log("");
  printDirectBox("CMP View", formatDirectCmpSnapshotLines(snapshot, latestTurn));
}

export function printTapArtifacts(runtime: LiveCliRuntime, sessionId: string, runId?: string): void {
  const governance = runtime.createTapGovernanceObject({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const userSurface = runtime.createTapUserSurfaceSnapshot({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const snapshot = runtime.createTapGovernanceSnapshot();
  const usage = runtime.createTapThreeAgentUsageReport({
    sessionId,
    runId,
  });
  const manifests = runtime.capabilityPool.listCapabilities();
  const capabilityKeys = manifests.map((manifest) => manifest.capabilityKey);
  const capabilityKeyById = new Map(manifests.map((manifest) => [manifest.capabilityId, manifest.capabilityKey]));
  const bindingKeys = runtime.capabilityPool
    .listBindings()
    .map((binding) => `${capabilityKeyById.get(binding.capabilityId) ?? binding.capabilityId}:${binding.state}`);

  printDivider("TAP Governance View");
  console.log(`summary: ${userSurface.summary}`);
  console.log(
    `visibleMode=${userSurface.visibleMode} automationDepth=${userSurface.automationDepth} currentLayer=${userSurface.currentLayer}`,
  );
  console.log(
    `workspaceMode=${governance.workspacePolicy.workspaceMode} taskMode=${governance.taskPolicy.taskMode} effectiveMode=${governance.taskPolicy.effectiveMode}`,
  );
  console.log(
    `pendingHumanGateCount=${userSurface.pendingHumanGateCount} activeCapabilityKeys=${userSurface.activeCapabilityKeys.join(", ") || "(none)"}`,
  );
  console.log(`blockingCapabilityKeys=${snapshot.blockingCapabilityKeys.join(", ") || "(none)"}`);
  console.log(`threeAgentUsage: ${usage.summary}`);
  console.log(`registeredCapabilities(${capabilityKeys.length}): ${capabilityKeys.join(", ") || "(none)"}`);
  console.log(`bindings(${bindingKeys.length}): ${bindingKeys.join(", ") || "(none)"}`);
  console.log("shared15ViewMatrix:");
  for (const line of formatTapMatrixRows(LIVE_CHAT_PERMISSIONS_CONFIG.shared15ViewMatrix)) {
    console.log(`  ${line}`);
  }
}

export function printCoreArtifacts(turn: CoreTurnArtifacts): void {
  printDivider("Core Result");
  console.log(`runId: ${turn.runId}`);
  console.log(`dispatchStatus: ${turn.dispatchStatus}`);
  console.log(`taskStatus: ${turn.taskStatus ?? "(none)"}`);
  console.log(`capability: ${turn.capabilityKey ?? "(none)"}`);
  console.log(`capabilityResultStatus: ${turn.capabilityResultStatus ?? "(none)"}`);
  console.log("\nAssistant:");
  console.log(turn.answer);
}

export function printDirectCapabilities(runtime: LiveCliRuntime): void {
  const capabilities = runtime.capabilityPool
    .listCapabilities()
    .map((manifest) => manifest.capabilityKey)
    .sort();
  const grouped = new Map<string, string[]>();
  for (const capability of capabilities) {
    const family = capability.split(".")[0] ?? "other";
    const bucket = grouped.get(family) ?? [];
    bucket.push(capability);
    grouped.set(family, bucket);
  }
  const lines = [`${capabilities.length} registered`];
  for (const [family, items] of grouped.entries()) {
    lines.push(`${family}: ${items.join(", ")}`);
  }
  console.log("");
  printDirectBox("Capabilities", lines);
}

export function printDirectStatus(state: LiveCliState): void {
  if (!state.lastTurn) {
    console.log("还没有跑任何一轮。先直接输入一句话。");
    return;
  }
  const governance = state.runtime.createTapGovernanceObject({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const snapshot = state.runtime.createTapGovernanceSnapshot();
  const cmpStatus = state.lastTurn.cmp.syncStatus;
  const coreTaskStatus = state.lastTurn.core.taskStatus ?? "completed";
  const capabilityResultStatus = state.lastTurn.core.capabilityResultStatus ?? "success";
  const capabilityStatusSuffix =
    state.lastTurn.core.capabilityKey === "browser.playwright"
    && coreTaskStatus === "completed"
    && capabilityResultStatus === "partial"
      ? " (任务已完成，但浏览器证据链是 partial)"
      : (state.lastTurn.core.capabilityKey === "search.web" || state.lastTurn.core.capabilityKey === "search.ground")
        && capabilityResultStatus === "partial"
        ? " (当前只是部分联网证据，不能自动视为最终完成)"
      : "";
  console.log("");
  printDirectBox("Status", [
    `core: ${state.lastTurn.core.dispatchStatus} / ${coreTaskStatus} / ${state.lastTurn.core.capabilityKey ?? "no capability"} / ${capabilityResultStatus}${capabilityStatusSuffix}`,
    `cmp: ${cmpStatus} / ${truncate(state.lastTurn.cmp.failureReason ?? state.lastTurn.cmp.intent, 96)}`,
    `tap: ${governance.taskPolicy.effectiveMode} / ${state.runtime.capabilityPool.listCapabilities().length} registered / ${snapshot.blockingCapabilityKeys.length} blocked`,
  ]);
}

export function printStatus(state: LiveCliState): void {
  if (!state.lastTurn) {
    console.log("还没有跑任何一轮。先直接输入一句话。");
    return;
  }

  if (state.uiMode === "direct") {
    printDirectStatus(state);
    printDirectAnswer(state.lastTurn.core);
    return;
  }

  printCmpArtifacts(state.lastTurn.cmp);
  printTapArtifacts(state.runtime, state.sessionId, state.lastTurn.core.runId);
  printCoreArtifacts(state.lastTurn.core);
}

export function printDirectAnswer(turn: CoreTurnArtifacts): void {
  console.log("");
  printDirectBox("Assistant", turn.answer.split("\n"));
}

export function printEvents(state: LiveCliState): void {
  if (!state.lastTurn) {
    console.log("还没有 core run 事件。");
    return;
  }
  printDivider("Core Event Types");
  for (const eventType of state.lastTurn.core.eventTypes) {
    console.log(`- ${eventType}`);
  }
}

export function printHistory(state: LiveCliState, historyTurns: number): void {
  printDivider("Dialogue History");
  console.log(formatTranscript(state.transcript.slice(-historyTurns)));
}

export function createDirectFallbackReader(): DirectFallbackReader {
  const fallbackReadline = createInterface({
    input,
    crlfDelay: Infinity,
    terminal: false,
  });
  let pending = "";
  let ended = false;
  const waiters: Array<() => void> = [];

  const wake = () => {
    while (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter?.();
    }
  };

  const onData = (chunk: Buffer | string) => {
    pending += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    wake();
  };

  const onEnd = () => {
    ended = true;
    wake();
  };

  input.on("data", onData);
  input.on("end", onEnd);
  input.on("close", onEnd);

  return {
    legacyReadline: fallbackReadline,
    close() {
      input.off("data", onData);
      input.off("end", onEnd);
      input.off("close", onEnd);
      fallbackReadline.close();
    },
    async read() {
      while (true) {
        const delimiterIndex = pending.indexOf("\u0000");
        if (delimiterIndex >= 0) {
          const message = pending.slice(0, delimiterIndex);
          pending = pending.slice(delimiterIndex + 1);
          return message;
        }

        if (ended) {
          if (pending.length === 0) {
            return null;
          }
          const message = pending;
          pending = "";
          return message;
        }

        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });
      }
    },
  };
}
