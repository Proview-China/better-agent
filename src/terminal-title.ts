export const RAXODE_TERMINAL_TITLE = "Raxode";
export const RAXODE_TERMINAL_TITLE_MOON_PHASES = [
  "🌑",
  "🌒",
  "🌓",
  "🌔",
  "🌕",
  "🌖",
  "🌗",
  "🌘",
] as const;

interface TerminalTitleWritable {
  isTTY?: boolean;
  write: (chunk: string) => unknown;
}

export function buildTerminalTitleSequence(title: string): string {
  return `\u001B]0;${title}\u0007`;
}

export function buildRaxodeTerminalTitle(frameIndex?: number | null): string {
  if (frameIndex === undefined || frameIndex === null) {
    return RAXODE_TERMINAL_TITLE;
  }
  const phase = RAXODE_TERMINAL_TITLE_MOON_PHASES[
    Math.abs(frameIndex) % RAXODE_TERMINAL_TITLE_MOON_PHASES.length
  ];
  return `${phase} ${RAXODE_TERMINAL_TITLE}`;
}

export function writeTerminalTitle(
  title: string,
  output: TerminalTitleWritable = process.stdout,
): void {
  if (!title || output.isTTY !== true) {
    return;
  }
  output.write(buildTerminalTitleSequence(title));
}
