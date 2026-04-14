import { setTuiTextInputValue, type TuiTextInputState } from "./text-input.js";

export interface ActiveFileMentionToken {
  query: string;
  tokenText: string;
  start: number;
  end: number;
}

export function findActiveFileMentionToken(
  value: string,
  cursorOffset: number,
): ActiveFileMentionToken | undefined {
  if (cursorOffset < 0 || cursorOffset > value.length) {
    return undefined;
  }
  const beforeCursor = value.slice(0, cursorOffset);
  const tokenStart = Math.max(
    beforeCursor.lastIndexOf(" ") + 1,
    beforeCursor.lastIndexOf("\n") + 1,
    beforeCursor.lastIndexOf("\t") + 1,
  );
  const tokenText = value.slice(tokenStart, cursorOffset);
  if (!tokenText.startsWith("@")) {
    return undefined;
  }
  if (tokenText.includes("[") || tokenText.includes("]")) {
    return undefined;
  }
  return {
    query: tokenText.slice(1),
    tokenText,
    start: tokenStart,
    end: cursorOffset,
  };
}

export function formatFileMentionToken(relativePath: string): string {
  return /\s/u.test(relativePath)
    ? `@"${relativePath}"`
    : `@${relativePath}`;
}

export function replaceFileMentionToken(
  state: TuiTextInputState,
  token: ActiveFileMentionToken,
  replacementPath: string,
): TuiTextInputState {
  const tokenText = `${formatFileMentionToken(replacementPath)} `;
  const nextValue = `${state.value.slice(0, token.start)}${tokenText}${state.value.slice(token.end)}`;
  return setTuiTextInputValue(state, nextValue, token.start + tokenText.length);
}
