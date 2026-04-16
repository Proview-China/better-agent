export type PraxisSlashPanelId =
  | "model"
  | "status"
  | "rush"
  | "exit"
  | "human-gate"
  | "cmp"
  | "mp"
  | "capabilities"
  | "init"
  | "question"
  | "resume"
  | "agents"
  | "permissions"
  | "workspace"
  | "language";

export type PraxisSlashPanelFieldTone =
  | "default"
  | "info"
  | "warning"
  | "danger"
  | "success"
  | "green"
  | "pink"
  | "brown"
  | "orange"
  | "fast"
  | "planPro"
  | "planPro5x"
  | "planPlus"
  | "planGo"
  | "planFree";

export interface PraxisSlashPanelFieldBase {
  key: string;
  label: string;
  note?: string;
  tone?: PraxisSlashPanelFieldTone;
}

export interface PraxisSlashPanelValueField extends PraxisSlashPanelFieldBase {
  kind: "value";
  value: string;
}

export interface PraxisSlashPanelChoiceField extends PraxisSlashPanelFieldBase {
  kind: "choice";
  value: string;
  options: string[];
}

export interface PraxisSlashPanelActionField extends PraxisSlashPanelFieldBase {
  kind: "action";
  value?: string;
  primary?: boolean;
}

export interface PraxisSlashPanelInputField extends PraxisSlashPanelFieldBase {
  kind: "input";
  value: string;
  placeholder?: string;
  submitActionKey?: string;
}

export type PraxisSlashPanelField =
  | PraxisSlashPanelValueField
  | PraxisSlashPanelChoiceField
  | PraxisSlashPanelActionField
  | PraxisSlashPanelInputField;

export interface PraxisSlashPanelBodyLine {
  text: string;
  tone?: PraxisSlashPanelFieldTone;
  fieldKey?: string;
  segments?: Array<{
    text: string;
    tone?: PraxisSlashPanelFieldTone;
  }>;
}

export interface PraxisSlashPanelView {
  id: PraxisSlashPanelId;
  title: string;
  description: string;
  status: string;
  viewerPage?: {
    pageIndex: number;
    pageCount: number;
    totalItems?: number;
  };
  bodyLines?: PraxisSlashPanelBodyLine[];
  showChrome?: boolean;
  showStatus?: boolean;
  showFields?: boolean;
  showHints?: boolean;
  fields: PraxisSlashPanelField[];
  hints: string[];
}

export const PRAXIS_SLASH_PANEL_IDS: PraxisSlashPanelId[] = [
  "model",
  "status",
  "rush",
  "exit",
  "human-gate",
  "cmp",
  "mp",
  "capabilities",
  "init",
  "question",
  "resume",
  "agents",
  "permissions",
  "workspace",
  "language",
];

export const PRAXIS_MODEL_OPTIONS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
] as const;

export const PRAXIS_REASONING_OPTIONS = [
  "minimal",
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export const PRAXIS_LANGUAGE_OPTIONS = [
  "en-US",
  "de-DE",
  "fr-FR",
  "es-419",
  "es-ES",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-HK",
  "zh-TW",
] as const;

export const PRAXIS_AGENTS_VIEW_OPTIONS = [
  "list",
  "focus",
] as const;

export const PRAXIS_STARTUP_VIEW_OPTIONS = [
  "chat",
  "agents",
] as const;

export const PRAXIS_PERMISSION_MODE_OPTIONS = [
  "bapr",
  "yolo",
  "permissive",
  "standard",
  "restricted",
] as const;

export const PRAXIS_AUTOMATION_DEPTH_OPTIONS = [
  "default",
  "prefer_auto",
  "prefer_human",
] as const;

export function isInteractivePanelField(field: PraxisSlashPanelField): boolean {
  return field.kind === "choice" || field.kind === "action" || field.kind === "input";
}

export function findNextInteractiveFieldIndex(
  fields: PraxisSlashPanelField[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (fields.length === 0) {
    return 0;
  }
  const interactiveIndices = fields
    .map((field, index) => ({ field, index }))
    .filter((entry) => isInteractivePanelField(entry.field))
    .map((entry) => entry.index);
  if (interactiveIndices.length === 0) {
    return 0;
  }
  const currentInteractiveIndex = interactiveIndices.indexOf(currentIndex);
  if (currentInteractiveIndex === -1) {
    return interactiveIndices[0] ?? 0;
  }
  const nextInteractiveIndex =
    (currentInteractiveIndex + direction + interactiveIndices.length) % interactiveIndices.length;
  return interactiveIndices[nextInteractiveIndex] ?? interactiveIndices[0] ?? 0;
}

export function cycleChoiceValue(
  field: PraxisSlashPanelChoiceField,
  currentValue: string,
  direction: 1 | -1,
): string {
  if (field.options.length === 0) {
    return currentValue;
  }
  const currentIndex = field.options.indexOf(currentValue);
  const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (normalizedIndex + direction + field.options.length) % field.options.length;
  return field.options[nextIndex] ?? field.options[0] ?? currentValue;
}

export function findPrimaryActionField(
  fields: PraxisSlashPanelField[],
): PraxisSlashPanelActionField | undefined {
  const primary = fields.find((field) => field.kind === "action" && field.primary);
  if (primary && primary.kind === "action") {
    return primary;
  }
  const firstAction = fields.find((field) => field.kind === "action");
  return firstAction && firstAction.kind === "action" ? firstAction : undefined;
}
