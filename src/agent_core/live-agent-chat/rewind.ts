import type { DialogueTurn } from "./shared.js";

export interface RewindDialogueResult {
  transcript: DialogueTurn[];
  nextTurnIndex: number;
  removedTurns: number;
}

export function rewindDialogueTranscript(
  transcript: readonly DialogueTurn[],
  currentTurnIndex: number,
  targetTurnIndex: number,
): RewindDialogueResult {
  if (!Number.isFinite(targetTurnIndex) || targetTurnIndex <= 0) {
    throw new Error("rewind target must be a positive turn index");
  }
  if (targetTurnIndex > currentTurnIndex) {
    throw new Error(`cannot rewind to turn ${targetTurnIndex}; current turn is ${currentTurnIndex}`);
  }
  return {
    transcript: transcript.slice(0, targetTurnIndex * 2),
    nextTurnIndex: targetTurnIndex,
    removedTurns: currentTurnIndex - targetTurnIndex,
  };
}
