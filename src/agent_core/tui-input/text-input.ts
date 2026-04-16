import type { Key } from "ink";

export interface TuiTextInputState {
  value: string;
  cursorOffset: number;
}

export interface RenderedTuiCursor {
  before: string;
  cursor: string;
  after: string;
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });
const SPECIAL_TOKEN_PATTERN = /\[(?:Image #\d+|Pasted Content #\d+ with \d+ characters)\]/gu;

function estimateTerminalWidth(text: string): number {
  let width = 0;
  for (const char of [...text]) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += codePoint >= 0x1100 ? 2 : 1;
  }
  return width;
}

function clampOffset(value: string, offset: number): number {
  return Math.max(0, Math.min(value.length, offset));
}

function graphemeBreaks(value: string): number[] {
  const breaks = [0];
  for (const segment of GRAPHEME_SEGMENTER.segment(value)) {
    breaks.push(segment.index + segment.segment.length);
  }
  return breaks;
}

function previousGraphemeOffset(value: string, offset: number): number {
  const normalizedOffset = clampOffset(value, offset);
  const breaks = graphemeBreaks(value);
  for (let index = breaks.length - 1; index >= 0; index -= 1) {
    const candidate = breaks[index];
    if (candidate === undefined) {
      continue;
    }
    if (candidate < normalizedOffset) {
      return candidate;
    }
  }
  return 0;
}

function nextGraphemeOffset(value: string, offset: number): number {
  const normalizedOffset = clampOffset(value, offset);
  const breaks = graphemeBreaks(value);
  for (const candidate of breaks) {
    if (candidate > normalizedOffset) {
      return candidate;
    }
  }
  return value.length;
}

interface TokenRange {
  start: number;
  end: number;
}

function specialTokenRangeForDeletion(
  value: string,
  cursorOffset: number,
  direction: "backward" | "forward",
): TokenRange | undefined {
  const normalizedOffset = clampOffset(value, cursorOffset);
  for (const match of value.matchAll(SPECIAL_TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (direction === "backward") {
      if (normalizedOffset > start && normalizedOffset <= end) {
        return { start, end };
      }
      continue;
    }
    if (normalizedOffset >= start && normalizedOffset < end) {
      return { start, end };
    }
  }
  return undefined;
}

interface LineRange {
  start: number;
  end: number;
}

function lineRanges(value: string): LineRange[] {
  const ranges: LineRange[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") {
      ranges.push({ start, end: index });
      start = index + 1;
    }
  }
  ranges.push({ start, end: value.length });
  return ranges;
}

function findLineIndexForOffset(ranges: LineRange[], offset: number): number {
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (range && offset >= range.start && offset <= range.end) {
      return index;
    }
  }
  return Math.max(0, ranges.length - 1);
}

function offsetForVisualColumn(value: string, range: LineRange, targetColumn: number): number {
  let offset = range.start;
  let width = 0;
  while (offset < range.end) {
    const nextOffset = nextGraphemeOffset(value, offset);
    const segment = value.slice(offset, nextOffset);
    const nextWidth = width + estimateTerminalWidth(segment);
    if (nextWidth > targetColumn) {
      break;
    }
    width = nextWidth;
    offset = nextOffset;
  }
  return offset;
}

function moveCursorVertical(state: TuiTextInputState, direction: -1 | 1): TuiTextInputState {
  const ranges = lineRanges(state.value);
  const currentLineIndex = findLineIndexForOffset(ranges, state.cursorOffset);
  const currentRange = ranges[currentLineIndex];
  if (!currentRange) {
    return state;
  }
  const targetLineIndex = currentLineIndex + direction;
  const targetRange = ranges[targetLineIndex];
  if (!targetRange) {
    return state;
  }

  const currentColumn = estimateTerminalWidth(
    state.value.slice(currentRange.start, state.cursorOffset),
  );

  return {
    ...state,
    cursorOffset: offsetForVisualColumn(state.value, targetRange, currentColumn),
  };
}

export function createTuiTextInputState(value = ""): TuiTextInputState {
  return {
    value,
    cursorOffset: value.length,
  };
}

export function setTuiTextInputValue(
  state: TuiTextInputState,
  value: string,
  cursorOffset = value.length,
): TuiTextInputState {
  return {
    value,
    cursorOffset: clampOffset(value, cursorOffset),
  };
}

export function insertIntoTuiTextInput(
  state: TuiTextInputState,
  insertedText: string,
): TuiTextInputState {
  if (insertedText.length === 0) {
    return state;
  }
  const before = state.value.slice(0, state.cursorOffset);
  const after = state.value.slice(state.cursorOffset);
  const nextValue = `${before}${insertedText}${after}`;
  return {
    value: nextValue,
    cursorOffset: before.length + insertedText.length,
  };
}

export function deleteBackwardInTuiTextInput(state: TuiTextInputState): TuiTextInputState {
  if (state.cursorOffset <= 0) {
    return state;
  }
  const tokenRange = specialTokenRangeForDeletion(state.value, state.cursorOffset, "backward");
  if (tokenRange) {
    return {
      value: `${state.value.slice(0, tokenRange.start)}${state.value.slice(tokenRange.end)}`,
      cursorOffset: tokenRange.start,
    };
  }
  const previousOffset = previousGraphemeOffset(state.value, state.cursorOffset);
  return {
    value: `${state.value.slice(0, previousOffset)}${state.value.slice(state.cursorOffset)}`,
    cursorOffset: previousOffset,
  };
}

export function deleteForwardInTuiTextInput(state: TuiTextInputState): TuiTextInputState {
  if (state.cursorOffset >= state.value.length) {
    return state;
  }
  const tokenRange = specialTokenRangeForDeletion(state.value, state.cursorOffset, "forward");
  if (tokenRange) {
    return {
      value: `${state.value.slice(0, tokenRange.start)}${state.value.slice(tokenRange.end)}`,
      cursorOffset: tokenRange.start,
    };
  }
  const nextOffset = nextGraphemeOffset(state.value, state.cursorOffset);
  return {
    value: `${state.value.slice(0, state.cursorOffset)}${state.value.slice(nextOffset)}`,
    cursorOffset: state.cursorOffset,
  };
}

export function moveTuiTextInputCursorLeft(state: TuiTextInputState): TuiTextInputState {
  return {
    ...state,
    cursorOffset: previousGraphemeOffset(state.value, state.cursorOffset),
  };
}

export function moveTuiTextInputCursorRight(state: TuiTextInputState): TuiTextInputState {
  return {
    ...state,
    cursorOffset: nextGraphemeOffset(state.value, state.cursorOffset),
  };
}

export function moveTuiTextInputCursorHome(state: TuiTextInputState): TuiTextInputState {
  return {
    ...state,
    cursorOffset: 0,
  };
}

export function moveTuiTextInputCursorEnd(state: TuiTextInputState): TuiTextInputState {
  return {
    ...state,
    cursorOffset: state.value.length,
  };
}

export function moveTuiTextInputCursorUp(state: TuiTextInputState): TuiTextInputState {
  return moveCursorVertical(state, -1);
}

export function moveTuiTextInputCursorDown(state: TuiTextInputState): TuiTextInputState {
  return moveCursorVertical(state, 1);
}

export function renderTuiTextInputCursor(state: TuiTextInputState): RenderedTuiCursor {
  const cursorOffset = clampOffset(state.value, state.cursorOffset);
  if (cursorOffset >= state.value.length) {
    return {
      before: state.value,
      cursor: " ",
      after: "",
    };
  }

  const nextOffset = nextGraphemeOffset(state.value, cursorOffset);
  return {
    before: state.value.slice(0, cursorOffset),
    cursor: state.value.slice(cursorOffset, nextOffset) || " ",
    after: state.value.slice(nextOffset),
  };
}

export function isBackwardDeleteInput(inputText: string, key: Key): boolean {
  return key.backspace
    || key.delete
    || (key.ctrl && inputText === "h")
    || inputText.includes("\u007f")
    || inputText.includes("\b");
}

export function applyTuiTextInputKey(
  state: TuiTextInputState,
  inputText: string,
  key: Key,
): {
  nextState: TuiTextInputState;
  submit: boolean;
  handled: boolean;
} {
  const extendedKey = key as Key & { home?: boolean; end?: boolean };
  const shiftTabPressed = inputText === "\u001B[Z" || Boolean(key.tab && (extendedKey as Key & { shift?: boolean }).shift);
  if (key.leftArrow || (key.ctrl && inputText === "b")) {
    return { nextState: moveTuiTextInputCursorLeft(state), submit: false, handled: true };
  }
  if (key.rightArrow || (key.ctrl && inputText === "f")) {
    return { nextState: moveTuiTextInputCursorRight(state), submit: false, handled: true };
  }
  if (key.upArrow || (key.ctrl && inputText === "p")) {
    return { nextState: moveTuiTextInputCursorUp(state), submit: false, handled: true };
  }
  if (key.downArrow || (key.ctrl && inputText === "n")) {
    return { nextState: moveTuiTextInputCursorDown(state), submit: false, handled: true };
  }
  if (extendedKey.home || (key.ctrl && inputText === "a")) {
    return { nextState: moveTuiTextInputCursorHome(state), submit: false, handled: true };
  }
  if (extendedKey.end || (key.ctrl && inputText === "e")) {
    return { nextState: moveTuiTextInputCursorEnd(state), submit: false, handled: true };
  }
  if (isBackwardDeleteInput(inputText, key)) {
    return { nextState: deleteBackwardInTuiTextInput(state), submit: false, handled: true };
  }
  if (key.ctrl && inputText === "d") {
    return { nextState: deleteForwardInTuiTextInput(state), submit: false, handled: true };
  }
  if (key.return) {
    return { nextState: state, submit: true, handled: true };
  }
  if (key.ctrl && inputText === "j") {
    return { nextState: insertIntoTuiTextInput(state, "\n"), submit: false, handled: true };
  }
  if (shiftTabPressed) {
    return { nextState: state, submit: false, handled: true };
  }
  if (key.tab) {
    return { nextState: insertIntoTuiTextInput(state, "  "), submit: false, handled: true };
  }
  if (!inputText) {
    return { nextState: state, submit: false, handled: false };
  }

  // Some terminals/IME paths deliver DEL/BS as raw characters instead of
  // normalized Ink backspace key events. Apply them explicitly so backspace
  // works even when key.backspace is not set.
  if (isBackwardDeleteInput(inputText, key)) {
    let nextState = state;
    for (const char of [...inputText]) {
      if (char === "\u007f" || char === "\b") {
        nextState = deleteBackwardInTuiTextInput(nextState);
        continue;
      }
      nextState = insertIntoTuiTextInput(nextState, char);
    }
    return {
      nextState,
      submit: false,
      handled: true,
    };
  }

  return {
    nextState: insertIntoTuiTextInput(state, inputText),
    submit: false,
    handled: true,
  };
}
