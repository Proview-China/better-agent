import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ReadStream } from "node:tty";

import type {
  CmpTurnArtifacts,
  CoreTurnArtifacts,
  DirectFallbackReader,
  LiveCliState,
  LiveCliRuntime,
  OpenAILiveConfig,
} from "./shared.js";
import {
  formatDisplayValue,
  formatLiveStatus,
  formatRoutePlan,
  formatTapMatrixRows,
  formatTranscript,
  LIVE_CHAT_MODEL_PLAN,
  LIVE_CHAT_TAP_OVERRIDE,
  truncate,
} from "./shared.js";

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
  const next = await reader.iterator.next();
  if (next.done) {
    return null;
  }
  return next.value;
}

export function printStartup(config: OpenAILiveConfig): void {
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
  console.log("命令: /help /status /cmp /tap /events /history /exit");
}

export function printStartupDirect(config: OpenAILiveConfig): void {
  printDirectBox(">_ Praxis Direct CLI", [
    `model:     ${LIVE_CHAT_MODEL_PLAN.core.model} ${LIVE_CHAT_MODEL_PLAN.core.reasoning}`,
    `tap mode:  ${LIVE_CHAT_TAP_OVERRIDE.requestedMode} / ${LIVE_CHAT_TAP_OVERRIDE.automationDepth}`,
    `workspace: ${process.cwd().split("/").slice(-1)[0] || process.cwd()}`,
    `route:     ${config.baseURL}`,
  ]);
  console.log("Commands: /help /status /capabilities /history /exit");
  console.log("Composer: Enter send · Ctrl+J newline");
}

export function printHelp(uiMode: "full" | "direct"): void {
  if (uiMode === "direct") {
    console.log("");
    printDirectBox("Commands", [
      "/help         查看命令",
      "/status       查看最近一轮 CMP / TAP / core 总览",
      "/capabilities 查看当前 TAP 池中已注册能力",
      "/history      查看当前 CLI 内部对话历史摘要",
      "/cmp          查看最近一轮 CMP 摘要",
      "/tap          查看当前 TAP 治理视图",
      "/events       查看最近一轮 core run 事件类型",
      "/exit         退出",
    ]);
    return;
  }
  printDivider("Commands");
  console.log("/help    查看命令");
  console.log("/status  查看最近一轮 CMP/TAP/core 总览");
  console.log("/capabilities 查看当前 TAP 池中已注册能力");
  console.log("/cmp     查看最近一轮 CMP 摘要");
  console.log("/tap     查看当前 TAP 治理视图");
  console.log("/events   查看最近一轮 core run 事件类型");
  console.log("/history 查看当前 CLI 内部对话历史摘要");
  console.log("/exit    退出");
}

export function printCmpArtifacts(turn: CmpTurnArtifacts): void {
  printDivider("CMP Active View");
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
  console.log(
    `live: icma=${formatLiveStatus(turn.summary.live.icma)}, iterator=${formatLiveStatus(turn.summary.live.iterator)}, checker=${formatLiveStatus(turn.summary.live.checker)}, dbagent=${formatLiveStatus(turn.summary.live.dbagent)}, dispatcher=${formatLiveStatus(turn.summary.live.dispatcher)}`,
  );
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
  for (const line of formatTapMatrixRows(governance.shared15ViewMatrix)) {
    console.log(`  ${line}`);
  }
}

export function printCoreArtifacts(turn: CoreTurnArtifacts): void {
  printDivider("Core Result");
  console.log(`runId: ${turn.runId}`);
  console.log(`dispatchStatus: ${turn.dispatchStatus}`);
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
  console.log("");
  printDirectBox("Status", [
    `core: ${state.lastTurn.core.dispatchStatus} / ${state.lastTurn.core.capabilityKey ?? "no capability"} / ${state.lastTurn.core.capabilityResultStatus ?? "success"}`,
    `cmp: ${state.latestCmp ? "synced" : "warming"} / ${truncate(state.lastTurn.cmp.intent, 96)}`,
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
  return {
    readline: fallbackReadline,
    iterator: fallbackReadline[Symbol.asyncIterator](),
  };
}
