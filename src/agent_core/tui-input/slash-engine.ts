export interface PraxisSlashCommand {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  hidden?: boolean;
}

export interface PraxisSlashSuggestion {
  id: string;
  command: PraxisSlashCommand;
  displayText: string;
  description?: string;
  score: number;
  order: number;
}

export interface PraxisSlashState {
  active: boolean;
  query: string;
  suggestions: PraxisSlashSuggestion[];
}

export function formatSlashDisplayText(command: PraxisSlashCommand): string {
  if (!command.aliases || command.aliases.length === 0) {
    return `/${command.name}`;
  }
  return `/${command.name}(${command.aliases.join(", ")})`;
}

function normalizeSlashToken(value: string): string {
  return value.trim().replace(/^\//u, "").toLowerCase();
}

function commandMatchesQuery(command: PraxisSlashCommand, query: string): number | null {
  const normalizedQuery = normalizeSlashToken(query);
  const name = command.name.toLowerCase();

  if (normalizedQuery.length === 0) {
    return 10;
  }
  if (name === normalizedQuery) {
    return 100;
  }
  if (name.startsWith(normalizedQuery)) {
    return 80 - (name.length - normalizedQuery.length);
  }
  if (command.aliases?.some((alias) => alias.toLowerCase() === normalizedQuery)) {
    return 70;
  }
  if (command.aliases?.some((alias) => alias.toLowerCase().startsWith(normalizedQuery))) {
    return 60;
  }
  if (name.includes(normalizedQuery)) {
    return 30;
  }
  if (command.description?.toLowerCase().includes(normalizedQuery)) {
    return 10;
  }
  return null;
}

export function computeSlashState(
  input: string,
  commands: PraxisSlashCommand[],
): PraxisSlashState {
  if (!input.startsWith("/")) {
    return {
      active: false,
      query: "",
      suggestions: [],
    };
  }

  const firstToken = input.split(/\s+/u, 1)[0] ?? "/";
  const query = normalizeSlashToken(firstToken);
  const suggestions: PraxisSlashSuggestion[] = [];
  for (const [order, command] of commands.entries()) {
    if (command.hidden) {
      continue;
    }
    const score = commandMatchesQuery(command, query);
    if (score == null) {
      continue;
    }
    suggestions.push({
      id: command.id,
      command,
      displayText: formatSlashDisplayText(command),
      description: command.description,
      score,
      order,
    });
  }
  suggestions.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.order - right.order;
  });

  return {
    active: true,
    query,
    suggestions,
  };
}

export function applySlashSuggestion(
  input: string,
  suggestion: PraxisSlashSuggestion,
): {
  nextInput: string;
  nextCursorOffset: number;
} {
  const trimmedStart = input.match(/^\s*/u)?.[0] ?? "";
  const rest = input.trimStart().replace(/^\/\S*/u, "").replace(/^\s+/u, "");
  const nextInput = `${trimmedStart}/${suggestion.command.name}${rest.length > 0 ? ` ${rest}` : " "}`;
  return {
    nextInput,
    nextCursorOffset: nextInput.length,
  };
}

export const DEFAULT_PRAXIS_SLASH_COMMANDS: PraxisSlashCommand[] = [
  { id: "model", name: "model", description: "Choose model and reasoning settings" },
  { id: "status", name: "status", description: "View current working status" },
  { id: "rush", name: "rush", description: "Rush toward the goal at a faster speed." },
  { id: "exit", name: "exit", aliases: ["quit"], description: "Exit the current session" },
  { id: "cmp", name: "cmp", description: "View current context sections summary" },
  { id: "mp", name: "mp", description: "Browse current memory state" },
  { id: "capabilities", name: "capabilities", description: "View registered TAP capabilities" },
  { id: "init", name: "init", description: "Initialize the current workspace session" },
  { id: "resume", name: "resume", description: "Resume the latest session or current work" },
  { id: "agents", name: "agents", description: "Switch to agents view" },
  { id: "permissions", name: "permissions", description: "View current permissions and approvals" },
  { id: "workspace", name: "workspace", description: "Switch current workspace directory" },
  { id: "language", name: "language", description: "Switch current language mode", hidden: true },
];
