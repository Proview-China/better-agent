import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export type ClaudeCodeSkillOverlaySourceKind = "bundled-skill" | "prompt-command";

export interface ClaudeCodeSkillOverlaySnapshotEntry {
  id: string;
  name: string;
  description: string;
  whenToUse?: string;
  aliases: string[];
  sourceKind: ClaudeCodeSkillOverlaySourceKind;
  sourcePath: string;
  modelInvocable: boolean;
  userInvocable: boolean;
}

export interface ClaudeCodeSkillOverlaySnapshot {
  schemaVersion: "claudecode-skill-overlay-snapshot/v1";
  sourceRoot: string;
  entries: ClaudeCodeSkillOverlaySnapshotEntry[];
}

interface ParsedMetadata {
  name?: string;
  description?: string;
  whenToUse?: string;
  aliases?: string[];
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
}

const DEFAULT_SOURCE_ROOT = "claudecodesource";

const snapshotCache = new Map<string, ClaudeCodeSkillOverlaySnapshot>();

export function loadClaudeCodeSkillOverlaySnapshot(input: {
  sourceRoot?: string;
  forceReload?: boolean;
} = {}): ClaudeCodeSkillOverlaySnapshot {
  const sourceRoot = resolve(input.sourceRoot ?? join(process.cwd(), DEFAULT_SOURCE_ROOT));
  if (!input.forceReload) {
    const cached = snapshotCache.get(sourceRoot);
    if (cached) {
      return cached;
    }
  }

  const snapshot = buildClaudeCodeSkillOverlaySnapshot(sourceRoot);
  snapshotCache.set(sourceRoot, snapshot);
  return snapshot;
}

export function clearClaudeCodeSkillOverlaySnapshotCacheForTest(): void {
  snapshotCache.clear();
}

function buildClaudeCodeSkillOverlaySnapshot(
  sourceRoot: string,
): ClaudeCodeSkillOverlaySnapshot {
  if (!existsSync(sourceRoot)) {
    return {
      schemaVersion: "claudecode-skill-overlay-snapshot/v1",
      sourceRoot,
      entries: [],
    };
  }

  const bundledEntries = collectBundledSkillEntries(sourceRoot);
  const promptCommandEntries = collectPromptCommandEntries(sourceRoot);
  const deduped = dedupeSnapshotEntries([...bundledEntries, ...promptCommandEntries]);

  return {
    schemaVersion: "claudecode-skill-overlay-snapshot/v1",
    sourceRoot,
    entries: deduped.sort((left, right) =>
      left.name.localeCompare(right.name) || left.sourcePath.localeCompare(right.sourcePath)),
  };
}

function collectBundledSkillEntries(
  sourceRoot: string,
): ClaudeCodeSkillOverlaySnapshotEntry[] {
  const bundledRoot = join(sourceRoot, "skills", "bundled");
  if (!existsSync(bundledRoot)) {
    return [];
  }

  const entries: ClaudeCodeSkillOverlaySnapshotEntry[] = [];
  for (const filePath of walkSourceFiles(bundledRoot)) {
    const sourceText = readSourceFile(filePath);
    for (const objectText of extractObjectArguments(sourceText, "registerBundledSkill(")) {
      const metadata = parseMetadataObject(objectText);
      const entry = toSnapshotEntry({
        metadata,
        filePath,
        sourceRoot,
        sourceKind: "bundled-skill",
      });
      if (entry) {
        entries.push(entry);
      }
    }
  }
  return entries;
}

function collectPromptCommandEntries(
  sourceRoot: string,
): ClaudeCodeSkillOverlaySnapshotEntry[] {
  const commandsRoot = join(sourceRoot, "commands");
  if (!existsSync(commandsRoot)) {
    return [];
  }

  const entries: ClaudeCodeSkillOverlaySnapshotEntry[] = [];
  for (const filePath of walkSourceFiles(commandsRoot)) {
    const sourceText = readSourceFile(filePath);
    if (!looksLikePromptCommandSource(sourceText)) {
      continue;
    }

    for (const objectText of extractObjectArguments(
      sourceText,
      "createMovedToPluginCommand(",
    )) {
      const metadata = parseMetadataObject(objectText);
      const entry = toSnapshotEntry({
        metadata,
        filePath,
        sourceRoot,
        sourceKind: "prompt-command",
      });
      if (entry) {
        entries.push(entry);
      }
    }

    const promptMarkerIndexes = findAllPromptMarkerIndexes(sourceText);
    for (const markerIndex of promptMarkerIndexes) {
      const objectText = extractEnclosingObjectLiteral(sourceText, markerIndex);
      if (!objectText) {
        continue;
      }
      const metadata = parseMetadataObject(objectText);
      const entry = toSnapshotEntry({
        metadata,
        filePath,
        sourceRoot,
        sourceKind: "prompt-command",
      });
      if (entry) {
        entries.push(entry);
      }
    }
  }
  return entries;
}

function toSnapshotEntry(input: {
  metadata: ParsedMetadata;
  filePath: string;
  sourceRoot: string;
  sourceKind: ClaudeCodeSkillOverlaySourceKind;
}): ClaudeCodeSkillOverlaySnapshotEntry | undefined {
  const name = input.metadata.name?.trim();
  const description = input.metadata.description?.trim();
  if (!name || !description) {
    return undefined;
  }

  return {
    id: `${input.sourceKind}:${name}`,
    name,
    description,
    whenToUse: normalizeOptionalText(input.metadata.whenToUse),
    aliases: (input.metadata.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
    sourceKind: input.sourceKind,
    sourcePath: relative(input.sourceRoot, input.filePath),
    modelInvocable: input.metadata.disableModelInvocation !== true,
    userInvocable: input.metadata.userInvocable !== false,
  };
}

function dedupeSnapshotEntries(
  entries: ClaudeCodeSkillOverlaySnapshotEntry[],
): ClaudeCodeSkillOverlaySnapshotEntry[] {
  const deduped = new Map<string, ClaudeCodeSkillOverlaySnapshotEntry>();
  for (const entry of entries) {
    const existing = deduped.get(entry.id);
    if (!existing) {
      deduped.set(entry.id, entry);
      continue;
    }

    const existingWeight = scoreSnapshotEntryCompleteness(existing);
    const nextWeight = scoreSnapshotEntryCompleteness(entry);
    if (nextWeight > existingWeight) {
      deduped.set(entry.id, entry);
    }
  }

  return [...deduped.values()];
}

function scoreSnapshotEntryCompleteness(
  entry: ClaudeCodeSkillOverlaySnapshotEntry,
): number {
  return entry.description.length
    + (entry.whenToUse?.length ?? 0)
    + entry.aliases.join("").length;
}

function looksLikePromptCommandSource(sourceText: string): boolean {
  return sourceText.includes("type: 'prompt'")
    || sourceText.includes('type: "prompt"')
    || sourceText.includes("createMovedToPluginCommand(");
}

function findAllPromptMarkerIndexes(sourceText: string): number[] {
  const indexes: number[] = [];
  const markers = ["type: 'prompt'", 'type: "prompt"'];
  for (const marker of markers) {
    let cursor = sourceText.indexOf(marker);
    while (cursor >= 0) {
      indexes.push(cursor);
      cursor = sourceText.indexOf(marker, cursor + marker.length);
    }
  }
  return [...new Set(indexes)].sort((left, right) => left - right);
}

function walkSourceFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const nextPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (nextPath.endsWith(".ts") || nextPath.endsWith(".js")) {
        files.push(nextPath);
      }
    }
  }

  return files;
}

function readSourceFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function extractObjectArguments(sourceText: string, marker: string): string[] {
  const objects: string[] = [];
  let cursor = sourceText.indexOf(marker);

  while (cursor >= 0) {
    const objectStart = sourceText.indexOf("{", cursor + marker.length);
    if (objectStart < 0) {
      break;
    }
    const objectText = extractBalancedBlock(sourceText, objectStart, "{", "}");
    if (objectText) {
      objects.push(objectText);
    }
    cursor = sourceText.indexOf(marker, cursor + marker.length);
  }

  return objects;
}

function extractEnclosingObjectLiteral(
  sourceText: string,
  markerIndex: number,
): string | undefined {
  const objectStart = findEnclosingObjectStart(sourceText, markerIndex);
  if (objectStart < 0) {
    return undefined;
  }
  return extractBalancedBlock(sourceText, objectStart, "{", "}");
}

function findEnclosingObjectStart(sourceText: string, markerIndex: number): number {
  let depth = 0;
  let state: ScanState = "code";

  for (let index = markerIndex; index >= 0; index -= 1) {
    const previous = index > 0 ? sourceText[index - 1] : "";
    const next = sourceText[index + 1] ?? "";
    const current = sourceText[index]!;

    state = stepScanStateBackward(state, current, previous, next);
    if (state !== "code") {
      continue;
    }

    if (current === "}") {
      depth += 1;
      continue;
    }
    if (current === "{") {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    }
  }

  return -1;
}

type ScanState =
  | "code"
  | "single-quote"
  | "double-quote"
  | "template"
  | "line-comment"
  | "block-comment";

function stepScanStateBackward(
  state: ScanState,
  current: string,
  previous: string,
  next: string,
): ScanState {
  switch (state) {
    case "single-quote":
      return current === "'" && previous !== "\\" ? "code" : state;
    case "double-quote":
      return current === '"' && previous !== "\\" ? "code" : state;
    case "template":
      return current === "`" && previous !== "\\" ? "code" : state;
    case "line-comment":
      return current === "\n" ? "code" : state;
    case "block-comment":
      return current === "/" && next === "*" ? "code" : state;
    case "code":
    default:
      if (current === "'" && previous !== "\\") {
        return "single-quote";
      }
      if (current === '"' && previous !== "\\") {
        return "double-quote";
      }
      if (current === "`" && previous !== "\\") {
        return "template";
      }
      if (current === "/" && next === "/") {
        return "line-comment";
      }
      if (current === "/" && next === "*") {
        return "block-comment";
      }
      return state;
  }
}

function extractBalancedBlock(
  sourceText: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): string | undefined {
  if (sourceText[startIndex] !== openChar) {
    return undefined;
  }

  let depth = 0;
  let state: ScanState = "code";

  for (let index = startIndex; index < sourceText.length; index += 1) {
    const current = sourceText[index]!;
    const previous = index > 0 ? sourceText[index - 1] : "";
    const next = sourceText[index + 1] ?? "";

    if (state === "code") {
      if (current === "/" && next === "/") {
        state = "line-comment";
        index += 1;
        continue;
      }
      if (current === "/" && next === "*") {
        state = "block-comment";
        index += 1;
        continue;
      }
      if (current === "'") {
        state = "single-quote";
        continue;
      }
      if (current === '"') {
        state = "double-quote";
        continue;
      }
      if (current === "`") {
        state = "template";
        continue;
      }
      if (current === openChar) {
        depth += 1;
      } else if (current === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return sourceText.slice(startIndex, index + 1);
        }
      }
      continue;
    }

    if (state === "line-comment") {
      if (current === "\n") {
        state = "code";
      }
      continue;
    }
    if (state === "block-comment") {
      if (current === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "single-quote" && current === "'" && previous !== "\\") {
      state = "code";
      continue;
    }
    if (state === "double-quote" && current === '"' && previous !== "\\") {
      state = "code";
      continue;
    }
    if (state === "template" && current === "`" && previous !== "\\") {
      state = "code";
    }
  }

  return undefined;
}

function parseMetadataObject(objectText: string): ParsedMetadata {
  return {
    name: extractSingleStringProperty(objectText, "name"),
    description: extractDescriptionProperty(objectText),
    whenToUse: extractSingleStringProperty(objectText, "whenToUse"),
    aliases: extractStringArrayProperty(objectText, "aliases"),
    disableModelInvocation: extractBooleanProperty(objectText, "disableModelInvocation"),
    userInvocable: extractBooleanProperty(objectText, "userInvocable"),
  };
}

function extractDescriptionProperty(objectText: string): string | undefined {
  const property = findTopLevelPropertyExpression(objectText, "description");
  if (!property) {
    return undefined;
  }

  if (property.kind === "value") {
    return firstMeaningfulStringLiteral(property.expression);
  }

  const literals = extractStringLiterals(property.expression);
  if (literals.length === 0) {
    return undefined;
  }
  return literals.sort((left, right) => right.length - left.length)[0];
}

function extractSingleStringProperty(
  objectText: string,
  propertyName: string,
): string | undefined {
  const property = findTopLevelPropertyExpression(objectText, propertyName);
  if (!property) {
    return undefined;
  }
  return firstMeaningfulStringLiteral(property.expression);
}

function extractStringArrayProperty(
  objectText: string,
  propertyName: string,
): string[] | undefined {
  const property = findTopLevelPropertyExpression(objectText, propertyName);
  if (!property) {
    return undefined;
  }
  const expression = property.expression.trim();
  if (!expression.startsWith("[")) {
    return undefined;
  }

  const values = extractStringLiterals(expression);
  return values.length > 0 ? values : undefined;
}

function extractBooleanProperty(
  objectText: string,
  propertyName: string,
): boolean | undefined {
  const property = findTopLevelPropertyExpression(objectText, propertyName);
  if (!property || property.kind !== "value") {
    return undefined;
  }

  const normalized = property.expression.trim();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

interface TopLevelPropertyExpression {
  kind: "value" | "getter";
  expression: string;
}

function findTopLevelPropertyExpression(
  objectText: string,
  propertyName: string,
): TopLevelPropertyExpression | undefined {
  let index = 1;
  while (index < objectText.length - 1) {
    index = skipSpaceCommentsAndCommas(objectText, index);
    if (index >= objectText.length - 1) {
      break;
    }

    const getterMatch = objectText.slice(index).match(/^get\s+([A-Za-z0-9_$]+)\s*\(\)\s*\{/);
    if (getterMatch) {
      const getterName = getterMatch[1]!;
      const bodyStart = index + getterMatch[0].length - 1;
      const bodyText = extractBalancedBlock(objectText, bodyStart, "{", "}");
      if (!bodyText) {
        break;
      }
      if (getterName === propertyName) {
        return {
          kind: "getter",
          expression: bodyText,
        };
      }
      index = bodyStart + bodyText.length;
      continue;
    }

    const keyMatch = objectText.slice(index).match(/^([A-Za-z0-9_$]+)\s*:/);
    if (!keyMatch) {
      index += 1;
      continue;
    }

    const key = keyMatch[1]!;
    const expressionStart = index + keyMatch[0].length;
    const expressionEnd = findExpressionEnd(objectText, expressionStart);
    if (key === propertyName) {
      return {
        kind: "value",
        expression: objectText.slice(expressionStart, expressionEnd),
      };
    }
    index = expressionEnd + 1;
  }

  return undefined;
}

function skipSpaceCommentsAndCommas(sourceText: string, startIndex: number): number {
  let index = startIndex;
  while (index < sourceText.length) {
    const current = sourceText[index]!;
    const next = sourceText[index + 1] ?? "";
    if (/\s|,/.test(current)) {
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < sourceText.length && sourceText[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < sourceText.length && !(sourceText[index] === "*" && sourceText[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }
    break;
  }
  return index;
}

function findExpressionEnd(sourceText: string, startIndex: number): number {
  let index = startIndex;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let state: ScanState = "code";

  while (index < sourceText.length) {
    const current = sourceText[index]!;
    const previous = index > 0 ? sourceText[index - 1] : "";
    const next = sourceText[index + 1] ?? "";

    if (state === "code") {
      if (current === "/" && next === "/") {
        state = "line-comment";
        index += 2;
        continue;
      }
      if (current === "/" && next === "*") {
        state = "block-comment";
        index += 2;
        continue;
      }
      if (current === "'") {
        state = "single-quote";
        index += 1;
        continue;
      }
      if (current === '"') {
        state = "double-quote";
        index += 1;
        continue;
      }
      if (current === "`") {
        state = "template";
        index += 1;
        continue;
      }
      if (current === "{") {
        braceDepth += 1;
      } else if (current === "}") {
        if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
          return index;
        }
        braceDepth -= 1;
      } else if (current === "[") {
        bracketDepth += 1;
      } else if (current === "]") {
        bracketDepth -= 1;
      } else if (current === "(") {
        parenDepth += 1;
      } else if (current === ")") {
        parenDepth -= 1;
      } else if (current === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        return index;
      }
      index += 1;
      continue;
    }

    if (state === "line-comment") {
      if (current === "\n") {
        state = "code";
      }
      index += 1;
      continue;
    }
    if (state === "block-comment") {
      if (current === "*" && next === "/") {
        state = "code";
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (state === "single-quote" && current === "'" && previous !== "\\") {
      state = "code";
    } else if (state === "double-quote" && current === '"' && previous !== "\\") {
      state = "code";
    } else if (state === "template" && current === "`" && previous !== "\\") {
      state = "code";
    }
    index += 1;
  }

  return sourceText.length;
}

function firstMeaningfulStringLiteral(expression: string): string | undefined {
  const literals = extractStringLiterals(expression)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !value.includes("${"));
  return literals[0];
}

function extractStringLiterals(expression: string): string[] {
  const literals: string[] = [];
  for (let index = 0; index < expression.length; index += 1) {
    const current = expression[index]!;
    if (current !== "'" && current !== '"' && current !== "`") {
      continue;
    }
    const quote = current;
    let cursor = index + 1;
    let literal = "";
    while (cursor < expression.length) {
      const char = expression[cursor]!;
      const previous = cursor > 0 ? expression[cursor - 1] : "";
      if (char === quote && previous !== "\\") {
        literals.push(unescapeSimpleStringLiteral(literal, quote));
        index = cursor;
        break;
      }
      literal += char;
      cursor += 1;
    }
  }
  return literals;
}

function unescapeSimpleStringLiteral(value: string, quote: string): string {
  if (quote === "`") {
    return value
      .replace(/\\`/g, "`")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }
  try {
    return JSON.parse(`${quote}${value}${quote}`) as string;
  } catch {
    return value;
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
