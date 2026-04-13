import type { GoalPromptBlock } from "../types/kernel-goal.js";
import { createCoreDevelopmentPromptPack } from "./development.js";
import { renderCoreContextualUserV1 } from "./contextual.js";
import { renderCoreOverlayIndexV1 } from "./overlays.js";
import { createCoreSystemPromptPack } from "./system.js";
import type {
  CoreContextualUserV1,
  CoreDevelopmentPromptInput,
  CorePromptMessage,
} from "./types.js";

function renderSection(tag: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }
  return [
    `<${tag}>`,
    trimmed,
    `</${tag}>`,
  ].join("\n");
}

function createPromptBlock(key: string, title: string, body: string): GoalPromptBlock | undefined {
  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }
  return {
    key,
    title,
    lines: trimmed.split("\n"),
  };
}

export function renderLiveChatPromptAssembly(input: {
  developmentInput: CoreDevelopmentPromptInput;
  contextualInput: CoreContextualUserV1;
  modeInstructions?: string[];
  contractInstructions?: string[];
}): string {
  const systemText = createCoreSystemPromptPack().text;
  const developmentText = createCoreDevelopmentPromptPack(input.developmentInput).text;
  const overlayText = input.contextualInput.overlayIndex
    ? renderCoreOverlayIndexV1(input.contextualInput.overlayIndex)
    : "";
  const contextualText = renderCoreContextualUserV1(input.contextualInput);
  const modeText = (input.modeInstructions ?? []).filter(Boolean).join("\n");
  const contractText = (input.contractInstructions ?? []).filter(Boolean).join("\n");

  return [
    renderSection("core_system", systemText),
    renderSection("core_development", developmentText),
    overlayText,
    renderSection("core_contextual_user", contextualText),
    renderSection("core_mode_instructions", modeText),
    renderSection("core_contract_instructions", contractText),
  ].filter((section) => section.length > 0).join("\n\n");
}

export function buildLiveChatPromptMessages(input: {
  developmentInput: CoreDevelopmentPromptInput;
  contextualInput: CoreContextualUserV1;
  modeInstructions?: string[];
  contractInstructions?: string[];
}): CorePromptMessage[] {
  const systemText = createCoreSystemPromptPack().text.trim();
  const developmentText = createCoreDevelopmentPromptPack(input.developmentInput).text.trim();
  const overlayText = input.contextualInput.overlayIndex
    ? renderCoreOverlayIndexV1(input.contextualInput.overlayIndex).trim()
    : "";
  const contextualText = renderCoreContextualUserV1(input.contextualInput).trim();
  const developerText = [
    developmentText,
    ...(input.modeInstructions ?? []).filter(Boolean),
    ...(input.contractInstructions ?? []).filter(Boolean),
  ].join("\n\n").trim();

  return [
    systemText ? { role: "system", content: systemText } : undefined,
    developerText ? { role: "developer", content: developerText } : undefined,
    [overlayText, contextualText].filter(Boolean).join("\n\n").trim()
      ? { role: "user", content: [overlayText, contextualText].filter(Boolean).join("\n\n").trim() }
      : undefined,
  ].filter((entry): entry is CorePromptMessage => Boolean(entry));
}

export function buildLiveChatPromptBlocks(input: {
  developmentInput: CoreDevelopmentPromptInput;
  contextualInput: CoreContextualUserV1;
  modeInstructions?: string[];
  contractInstructions?: string[];
}): GoalPromptBlock[] {
  const systemText = createCoreSystemPromptPack().text;
  const developmentText = createCoreDevelopmentPromptPack(input.developmentInput).text;
  const overlayText = input.contextualInput.overlayIndex
    ? renderCoreOverlayIndexV1(input.contextualInput.overlayIndex)
    : "";
  const contextualText = renderCoreContextualUserV1(input.contextualInput);
  const modeText = (input.modeInstructions ?? []).filter(Boolean).join("\n");
  const contractText = (input.contractInstructions ?? []).filter(Boolean).join("\n");

  return [
    createPromptBlock("core_system", "core_system", systemText),
    createPromptBlock("core_development", "core_development", developmentText),
    createPromptBlock("core_overlay_index", "core_overlay_index", overlayText),
    createPromptBlock("core_contextual_user", "core_contextual_user", contextualText),
    createPromptBlock("core_mode_instructions", "core_mode_instructions", modeText),
    createPromptBlock("core_contract_instructions", "core_contract_instructions", contractText),
  ].filter((block): block is GoalPromptBlock => Boolean(block));
}
