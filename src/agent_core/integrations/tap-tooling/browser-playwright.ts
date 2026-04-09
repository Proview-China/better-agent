import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { rax } from "../../../rax/index.js";
import type {
  McpCallResult,
  ProviderId,
  SdkLayer,
} from "../../../rax/index.js";
import type { CapabilityInvocationPlan } from "../../capability-types/index.js";
import type {
  BrowserPlaywrightBackendKind,
  BrowserPlaywrightConnectInput,
  BrowserPlaywrightLaunchEvidence,
  BrowserPlaywrightRouteContext,
  BrowserPlaywrightRuntimeLike,
  BrowserPlaywrightSessionLike,
  BrowserPlaywrightToolCallResult,
  NormalizedBrowserPlaywrightToolResult,
  NormalizedBrowserPlaywrightInput,
} from "./shared.js";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  asStringArray,
} from "./shared.js";
import { trimCommandOutput } from "./command-runtime.js";

export const PLAYWRIGHT_MCP_NPX_ARGS = [
  "-y",
  "@playwright/mcp@latest",
];

export const BROWSER_PLAYWRIGHT_TOOL_ALIASES: Record<string, string> = {
  browser_navigate: "browser_navigate",
  navigate: "browser_navigate",
  navigate_page: "browser_navigate",
  new_page: "browser_navigate",
  browser_snapshot: "browser_snapshot",
  snapshot: "browser_snapshot",
  take_snapshot: "browser_snapshot",
  browser_take_screenshot: "browser_take_screenshot",
  screenshot: "browser_take_screenshot",
  take_screenshot: "browser_take_screenshot",
  browser_click: "browser_click",
  click: "browser_click",
  browser_type: "browser_type",
  type: "browser_type",
  type_text: "browser_type",
  fill: "browser_type",
  browser_wait_for: "browser_wait_for",
  wait_for: "browser_wait_for",
  browser_console_messages: "browser_console_messages",
  console_messages: "browser_console_messages",
  browser_network_requests: "browser_network_requests",
  network_requests: "browser_network_requests",
  browser_tabs: "browser_tabs",
  tabs: "browser_tabs",
  browser_close: "browser_close",
  close: "browser_close",
  browser_hover: "browser_hover",
  hover: "browser_hover",
  browser_press_key: "browser_press_key",
  press_key: "browser_press_key",
  browser_select_option: "browser_select_option",
  select_option: "browser_select_option",
  browser_drag: "browser_drag",
  drag: "browser_drag",
  browser_handle_dialog: "browser_handle_dialog",
  handle_dialog: "browser_handle_dialog",
  browser_fill_form: "browser_fill_form",
  fill_form: "browser_fill_form",
  browser_navigate_back: "browser_navigate_back",
  navigate_back: "browser_navigate_back",
  browser_resize: "browser_resize",
  resize: "browser_resize",
  browser_file_upload: "browser_file_upload",
  upload_file: "browser_file_upload",
};

const REVIEWED_BROWSER_PLAYWRIGHT_RAW_TOOL_NAMES = new Set<string>([
  "browser_navigate",
  "browser_snapshot",
  "browser_take_screenshot",
  "browser_click",
  "browser_type",
  "browser_wait_for",
  "browser_console_messages",
  "browser_network_requests",
  "browser_tabs",
  "browser_close",
  "browser_hover",
  "browser_press_key",
  "browser_select_option",
  "browser_drag",
  "browser_handle_dialog",
  "browser_fill_form",
  "browser_navigate_back",
  "browser_resize",
  "browser_file_upload",
]);

function isProviderId(value: unknown): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "deepmind";
}

function isSdkLayer(value: unknown): value is SdkLayer {
  return value === "api" || value === "agent" || value === "auto";
}

function inferProviderFromModel(model: string | undefined): ProviderId | undefined {
  if (!model) {
    return undefined;
  }
  if (/claude/iu.test(model)) {
    return "anthropic";
  }
  if (/gemini/iu.test(model)) {
    return "deepmind";
  }
  if (/^gpt|^o[13-9]|codex/iu.test(model)) {
    return "openai";
  }
  return undefined;
}

export function normalizeOptionalBrowserRoute(
  input: Record<string, unknown>,
): BrowserPlaywrightRouteContext | undefined {
  const route = asRecord(input.route);
  const model = asString(route?.model ?? input.model);
  const provider = route?.provider ?? input.provider ?? inferProviderFromModel(model);
  const layerCandidate = route?.layer ?? input.layer;
  const layer = isSdkLayer(layerCandidate) ? layerCandidate : undefined;
  if (!isProviderId(provider) && !model && !layer) {
    return undefined;
  }
  return {
    provider: isProviderId(provider) ? provider : undefined,
    model,
    layer,
  };
}

export function selectBrowserPlaywrightBackend(
  route: BrowserPlaywrightRouteContext | undefined,
): BrowserPlaywrightBackendKind {
  if (route?.provider === "openai") {
    return "openai-codex-browser-mcp-style";
  }
  if (route?.provider === "anthropic") {
    return "anthropic-claude-code-browser-mcp-style";
  }
  if (route?.provider === "deepmind") {
    return "gemini-cli-browser-agent-style";
  }
  return "playwright-shared-runtime";
}

export function normalizeBrowserPlaywrightAction(
  value: string | undefined,
): NormalizedBrowserPlaywrightInput["action"] {
  switch ((value ?? "").trim().toLowerCase()) {
    case "connect":
      return "connect";
    case "list_tools":
    case "list-tools":
    case "tools":
      return "list_tools";
    case "disconnect":
    case "terminate":
      return "disconnect";
    case "navigate":
    case "navigate_page":
    case "new_page":
      return "navigate";
    case "navigate_back":
      return "navigate_back";
    case "snapshot":
    case "take_snapshot":
      return "snapshot";
    case "screenshot":
    case "take_screenshot":
      return "screenshot";
    case "click":
      return "click";
    case "hover":
      return "hover";
    case "type":
    case "type_text":
    case "fill":
      return "type";
    case "press_key":
      return "press_key";
    case "select_option":
      return "select_option";
    case "drag":
      return "drag";
    case "fill_form":
      return "fill_form";
    case "handle_dialog":
      return "handle_dialog";
    case "resize":
      return "resize";
    case "wait_for":
      return "wait_for";
    case "console_messages":
      return "console_messages";
    case "network_requests":
      return "network_requests";
    case "tabs":
      return "tabs";
    case "close":
      return "close";
    case "raw":
      return "raw";
    default:
      return "raw";
  }
}

export function normalizeBrowserPlaywrightToolName(toolName: string): string {
  const normalized = toolName.trim();
  return BROWSER_PLAYWRIGHT_TOOL_ALIASES[normalized] ?? normalized;
}

function assertReviewedBrowserPlaywrightRawToolAllowed(toolName: string): void {
  if (REVIEWED_BROWSER_PLAYWRIGHT_RAW_TOOL_NAMES.has(toolName)) {
    return;
  }
  throw new Error(
    `browser.playwright raw blocked unreviewed MCP tool ${toolName}. Use a reviewed action or extend the reviewed allowlist first.`,
  );
}

function matchesAllowedBrowserDomain(hostname: string, allowedDomains: readonly string[]): boolean {
  const normalizedHost = hostname.toLowerCase();
  return allowedDomains.some((entry) => {
    const normalizedEntry = entry.toLowerCase();
    if (normalizedEntry.startsWith("*.")) {
      const suffix = normalizedEntry.slice(2);
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
    }
    return normalizedHost === normalizedEntry;
  });
}

export function assertBrowserUrlAllowed(
  urlValue: string,
  allowedDomains: readonly string[] | undefined,
): void {
  if (!allowedDomains || allowedDomains.length === 0) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch (error) {
    throw new Error(`browser.playwright received an invalid URL: ${urlValue}.`, {
      cause: error,
    });
  }
  if (!matchesAllowedBrowserDomain(parsed.hostname, allowedDomains)) {
    throw new Error(`browser.playwright blocked navigation to ${parsed.hostname}; allowedDomains=${allowedDomains.join(", ")}.`);
  }
}

export function readBrowserPlaywrightArgs(
  input: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return asRecord(input.arguments) ?? asRecord(input.args);
}

export function normalizeBrowserPlaywrightInput(
  plan: CapabilityInvocationPlan,
): NormalizedBrowserPlaywrightInput {
  const input = asRecord(plan.input) ?? {};
  const action = normalizeBrowserPlaywrightAction(
    asString(input.action) ?? asString(input.toolName) ?? asString(input.name),
  );
  const allowedDomains = asStringArray(input.allowedDomains)
    ?? asStringArray(input.allowed_domains);
  const headless = asBoolean(input.headless) ?? true;
  const browserCandidate = asString(input.browser)?.toLowerCase();
  const browser =
    browserCandidate === "chromium"
    || browserCandidate === "firefox"
    || browserCandidate === "webkit"
    || browserCandidate === "chrome"
      ? browserCandidate
      : "chrome";
  const isolated = asBoolean(input.isolated) ?? true;
  const allowFileUploads = asBoolean(input.allowFileUploads)
    ?? asBoolean(input.allow_file_uploads)
    ?? false;
  const maxOutputChars = asNumber(input.maxOutputChars) ?? 12_000;
  const route = normalizeOptionalBrowserRoute(input);
  const selectedBackend = selectBrowserPlaywrightBackend(route);

  if (action === "connect" || action === "list_tools" || action === "disconnect") {
    return {
      action,
      route,
      selectedBackend,
      resolvedBackend: "playwright-shared-runtime",
      allowedDomains,
      headless,
      browser,
      isolated,
      allowFileUploads,
      maxOutputChars,
    };
  }

  let toolName: string | undefined;
  let argumentsRecord: Record<string, unknown> | undefined;
  switch (action) {
    case "navigate": {
      const url = asString(input.url);
      if (!url) {
        throw new Error("browser.playwright navigate requires url.");
      }
      assertBrowserUrlAllowed(url, allowedDomains);
      toolName = "browser_navigate";
      argumentsRecord = { url };
      break;
    }
    case "snapshot":
      toolName = "browser_snapshot";
      argumentsRecord = {};
      break;
    case "navigate_back":
      toolName = "browser_navigate_back";
      argumentsRecord = {};
      break;
    case "screenshot":
      toolName = "browser_take_screenshot";
      argumentsRecord = {
        type: asString(input.type) ?? "png",
      };
      if (asBoolean(input.fullPage) ?? asBoolean(input.full_page)) {
        argumentsRecord.fullPage = true;
      }
      if (asString(input.filename)) {
        argumentsRecord.filename = asString(input.filename);
      }
      if (asString(input.ref)) {
        argumentsRecord.ref = asString(input.ref);
      }
      if (asString(input.element)) {
        argumentsRecord.element = asString(input.element);
      }
      break;
    case "click":
      toolName = "browser_click";
      argumentsRecord = {
        ref: asString(input.ref),
      };
      if (!argumentsRecord.ref) {
        throw new Error("browser.playwright click requires ref.");
      }
      if (asString(input.element)) {
        argumentsRecord.element = asString(input.element);
      }
      if (asString(input.button)) {
        argumentsRecord.button = asString(input.button);
      }
      if (asBoolean(input.doubleClick) ?? asBoolean(input.double_click)) {
        argumentsRecord.doubleClick = true;
      }
      if (asStringArray(input.modifiers)) {
        argumentsRecord.modifiers = asStringArray(input.modifiers);
      }
      break;
    case "hover":
      toolName = "browser_hover";
      argumentsRecord = {
        ref: asString(input.ref),
      };
      if (!argumentsRecord.ref) {
        throw new Error("browser.playwright hover requires ref.");
      }
      if (asString(input.element)) {
        argumentsRecord.element = asString(input.element);
      }
      break;
    case "type":
      toolName = "browser_type";
      argumentsRecord = {
        ref: asString(input.ref),
        text: asString(input.text),
      };
      if (!argumentsRecord.ref || typeof argumentsRecord.text !== "string") {
        throw new Error("browser.playwright type requires ref and text.");
      }
      if (asString(input.element)) {
        argumentsRecord.element = asString(input.element);
      }
      if (asBoolean(input.slowly)) {
        argumentsRecord.slowly = true;
      }
      if (asBoolean(input.submit)) {
        argumentsRecord.submit = true;
      }
      break;
    case "press_key":
      toolName = "browser_press_key";
      argumentsRecord = {
        key: asString(input.key),
      };
      if (!argumentsRecord.key) {
        throw new Error("browser.playwright press_key requires key.");
      }
      break;
    case "select_option": {
      toolName = "browser_select_option";
      const values = asStringArray(input.values)
        ?? (asString(input.value) ? [asString(input.value)!] : undefined);
      argumentsRecord = {
        ref: asString(input.ref),
        values,
      };
      if (!argumentsRecord.ref || !Array.isArray(values) || values.length === 0) {
        throw new Error("browser.playwright select_option requires ref and one or more values.");
      }
      if (asString(input.element)) {
        argumentsRecord.element = asString(input.element);
      }
      break;
    }
    case "drag":
      toolName = "browser_drag";
      argumentsRecord = {
        startRef: asString(input.startRef) ?? asString(input.start_ref),
        endRef: asString(input.endRef) ?? asString(input.end_ref),
        startElement: asString(input.startElement) ?? asString(input.start_element),
        endElement: asString(input.endElement) ?? asString(input.end_element),
      };
      if (
        !argumentsRecord.startRef
        || !argumentsRecord.endRef
        || !argumentsRecord.startElement
        || !argumentsRecord.endElement
      ) {
        throw new Error("browser.playwright drag requires startRef, endRef, startElement, and endElement.");
      }
      break;
    case "fill_form": {
      toolName = "browser_fill_form";
      const fields = Array.isArray(input.fields)
        ? input.fields
          .map((entry) => asRecord(entry))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry))
          .map((entry) => ({
            name: asString(entry.name),
            ref: asString(entry.ref),
            selector: asString(entry.selector),
            type: asString(entry.type),
            value: asString(entry.value),
          }))
        : [];
      if (
        fields.length === 0
        || fields.some((entry) => !entry.name || !entry.type || !entry.value || (!entry.ref && !entry.selector))
      ) {
        throw new Error("browser.playwright fill_form requires structured fields with name, type, value, and ref or selector.");
      }
      argumentsRecord = { fields };
      break;
    }
    case "handle_dialog":
      toolName = "browser_handle_dialog";
      argumentsRecord = {
        accept: asBoolean(input.accept),
      };
      if (typeof argumentsRecord.accept !== "boolean") {
        throw new Error("browser.playwright handle_dialog requires accept=true|false.");
      }
      if (asString(input.promptText) ?? asString(input.prompt_text)) {
        argumentsRecord.promptText = asString(input.promptText) ?? asString(input.prompt_text);
      }
      break;
    case "resize":
      toolName = "browser_resize";
      argumentsRecord = {
        width: asNumber(input.width),
        height: asNumber(input.height),
      };
      if (typeof argumentsRecord.width !== "number" || typeof argumentsRecord.height !== "number") {
        throw new Error("browser.playwright resize requires numeric width and height.");
      }
      break;
    case "wait_for":
      toolName = "browser_wait_for";
      argumentsRecord = {};
      if (asString(input.text)) {
        argumentsRecord.text = asString(input.text);
      }
      if (asString(input.textGone) ?? asString(input.text_gone)) {
        argumentsRecord.textGone = asString(input.textGone) ?? asString(input.text_gone);
      }
      if (asNumber(input.time)) {
        argumentsRecord.time = asNumber(input.time);
      }
      if (Object.keys(argumentsRecord).length === 0) {
        throw new Error("browser.playwright wait_for requires text, textGone, or time.");
      }
      break;
    case "console_messages":
      toolName = "browser_console_messages";
      argumentsRecord = {
        level: asString(input.level) ?? "info",
      };
      if (asBoolean(input.all)) {
        argumentsRecord.all = true;
      }
      if (asString(input.filename)) {
        argumentsRecord.filename = asString(input.filename);
      }
      break;
    case "network_requests":
      toolName = "browser_network_requests";
      argumentsRecord = {
        requestBody: asBoolean(input.requestBody) ?? false,
        requestHeaders: asBoolean(input.requestHeaders) ?? false,
        static: asBoolean(input.static) ?? false,
      };
      if (asString(input.filter)) {
        argumentsRecord.filter = asString(input.filter);
      }
      if (asString(input.filename)) {
        argumentsRecord.filename = asString(input.filename);
      }
      break;
    case "tabs":
      toolName = "browser_tabs";
      argumentsRecord = {
        action: asString(input.tabAction) ?? asString(input.tab_action) ?? "list",
      };
      if (asNumber(input.index) !== undefined) {
        argumentsRecord.index = asNumber(input.index);
      }
      break;
    case "close":
      toolName = "browser_close";
      argumentsRecord = {};
      break;
    case "raw": {
      const rawToolName = asString(input.toolName) ?? asString(input.name);
      if (!rawToolName) {
        throw new Error("browser.playwright raw action requires toolName.");
      }
      toolName = normalizeBrowserPlaywrightToolName(rawToolName);
      assertReviewedBrowserPlaywrightRawToolAllowed(toolName);
      argumentsRecord = readBrowserPlaywrightArgs(input) ?? {};
      const rawUrl = asString(argumentsRecord.url);
      if (toolName === "browser_navigate" && rawUrl) {
        assertBrowserUrlAllowed(rawUrl, allowedDomains);
      }
      break;
    }
    default:
      throw new Error(`Unsupported browser.playwright action ${action}.`);
  }

  if (toolName === "browser_file_upload" && !allowFileUploads) {
    throw new Error("browser.playwright blocks file uploads unless allowFileUploads=true is provided.");
  }

  return {
    action,
    toolName,
    arguments: argumentsRecord,
    route,
    selectedBackend,
    resolvedBackend: "playwright-shared-runtime",
    allowedDomains,
    headless,
    browser,
    isolated,
    allowFileUploads,
    maxOutputChars,
  };
}

function resolveBrowserPlaywrightMcpBrowserConfig(
  browser: BrowserPlaywrightConnectInput["browser"],
): {
  browserName: "chromium" | "firefox" | "webkit";
  channel?: string;
} {
  switch (browser) {
    case "chrome":
      return { browserName: "chromium", channel: "chrome" };
    case "chromium":
      return { browserName: "chromium", channel: "chrome-for-testing" };
    case "firefox":
      return { browserName: "firefox" };
    case "webkit":
      return { browserName: "webkit" };
  }
}

function resolveBrowserPlaywrightLaunchProxyFromEnv(): {
  server?: string;
  bypass?: string;
} {
  const server = [
    process.env.PLAYWRIGHT_MCP_PROXY_SERVER,
    process.env.ALL_PROXY,
    process.env.all_proxy,
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
  ].find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
  const bypass = [
    process.env.PLAYWRIGHT_MCP_PROXY_BYPASS,
    process.env.NO_PROXY,
    process.env.no_proxy,
  ].find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
  return { server, bypass };
}

interface BrowserPlaywrightRuntimeLaunchConfig {
  args: string[];
  env: Record<string, string>;
  cleanup: () => Promise<void>;
  launchEvidence: BrowserPlaywrightLaunchEvidence;
}

async function createBrowserPlaywrightRuntimeLaunchConfig(
  input: BrowserPlaywrightConnectInput,
): Promise<BrowserPlaywrightRuntimeLaunchConfig> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "praxis-playwright-mcp-"));
  const outputDir = path.join(input.workspaceRoot, ".playwright-mcp");
  await mkdir(outputDir, { recursive: true });
  const configPath = path.join(tempRoot, "playwright-mcp.config.json");
  const { browserName, channel } = resolveBrowserPlaywrightMcpBrowserConfig(input.browser);
  const appliedIsolated = input.headless ? input.isolated : false;
  const userDataDir = appliedIsolated ? undefined : path.join(tempRoot, "profile");
  if (userDataDir) {
    await mkdir(userDataDir, { recursive: true });
  }
  const proxy = resolveBrowserPlaywrightLaunchProxyFromEnv();
  const launchOptions: Record<string, unknown> = { headless: input.headless };
  if (channel) {
    launchOptions.channel = channel;
  }
  if (!input.headless && process.env.WAYLAND_DISPLAY) {
    launchOptions.args = ["--ozone-platform=wayland"];
  }
  if (proxy.server) {
    launchOptions.proxy = {
      server: proxy.server,
      ...(proxy.bypass ? { bypass: proxy.bypass } : {}),
    };
  }
  const config = {
    browser: {
      browserName,
      isolated: appliedIsolated,
      ...(userDataDir ? { userDataDir } : {}),
      launchOptions,
    },
    outputDir,
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      DISPLAY: process.env.DISPLAY,
      WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY,
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
      XDG_SESSION_TYPE: process.env.XDG_SESSION_TYPE,
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return {
    args: [
      ...PLAYWRIGHT_MCP_NPX_ARGS,
      "--config",
      configPath,
      "--output-mode",
      "stdout",
    ],
    env,
    cleanup: async () => {
      await rm(tempRoot, { recursive: true, force: true });
    },
    launchEvidence: {
      requestedHeadless: input.headless,
      appliedHeadless: input.headless,
      requestedIsolated: input.isolated,
      appliedIsolated,
      verification: input.headless ? "config" : "unverified",
      configPath,
      userDataDir,
      proxyServer: proxy.server,
    },
  };
}

function collectBrowserPlaywrightProcessEvidence(
  launchEvidence: BrowserPlaywrightLaunchEvidence,
): BrowserPlaywrightLaunchEvidence {
  if (launchEvidence.appliedHeadless || !launchEvidence.userDataDir) {
    return launchEvidence;
  }
  const result = spawnSync("pgrep", ["-f", launchEvidence.userDataDir, "-a"], {
    encoding: "utf8",
  });
  const processSample = (result.stdout ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => !entry.includes("pgrep -f"));
  const browserSample = processSample.filter((entry) => /\/chrome\b|\/chromium\b|msedge/iu.test(entry));
  const processVerifiedHeaded = browserSample.length > 0
    && browserSample.every((entry) => !/--headless|--no-startup-window|ozone-platform=headless/iu.test(entry));
  return {
    ...launchEvidence,
    verification: processSample.length > 0 ? "process" : launchEvidence.verification,
    processVerifiedHeaded,
    processSample: processSample.slice(0, 8),
  };
}

export class SharedBrowserPlaywrightRuntime implements BrowserPlaywrightRuntimeLike {
  constructor(
    private readonly workspaceRoot: string,
  ) {}

  async use(input: BrowserPlaywrightConnectInput): Promise<BrowserPlaywrightSessionLike> {
    const launchConfig = await createBrowserPlaywrightRuntimeLaunchConfig({
      ...input,
      workspaceRoot: this.workspaceRoot,
    });
    const session = await rax.mcp.use({
      provider: "openai",
      model: "gpt-5",
      input: {
        connectionId: input.connectionId,
        transport: {
          kind: "stdio",
          command: "npx",
          args: launchConfig.args,
          env: launchConfig.env,
        },
        metadata: {
          capabilityKey: "browser.playwright",
          browser: input.browser,
          headless: input.headless,
          isolated: input.isolated,
        },
      },
    });

    return {
      connectionId: session.connection.connectionId,
      tools: async () => {
        const result = await session.tools();
        return {
          tools: result.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
          })),
        };
      },
      call: async (toolInput) => {
        const result: McpCallResult = await session.call({
          toolName: toolInput.toolName,
          arguments: toolInput.arguments,
        });
        return {
          content: result.content,
          structuredContent: result.structuredContent,
          _meta: result._meta,
          isError: result.isError,
          errorMessage: result.errorMessage,
          raw: result.raw,
        };
      },
      getLaunchEvidence: async () => collectBrowserPlaywrightProcessEvidence(launchConfig.launchEvidence),
      disconnect: async () => {
        await session.disconnect().catch(() => undefined);
        await launchConfig.cleanup().catch(() => undefined);
      },
    };
  }
}

export function normalizeBrowserPlaywrightToolResult(
  result: BrowserPlaywrightToolCallResult,
  maxOutputChars: number,
): NormalizedBrowserPlaywrightToolResult {
  const textParts: string[] = [];
  const imageUrls: string[] = [];
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      const record = asRecord(item);
      if (!record) {
        continue;
      }
      const type = asString(record.type);
      if (type === "text" && typeof record.text === "string") {
        textParts.push(record.text);
        continue;
      }
      if (type === "image" && typeof record.data === "string") {
        const mimeType = asString(record.mimeType) ?? "image/png";
        imageUrls.push(`data:${mimeType};base64,${record.data}`);
      }
    }
  }
  if (textParts.length === 0 && result.structuredContent) {
    textParts.push(JSON.stringify(result.structuredContent, null, 2));
  }
  if (textParts.length === 0 && result.errorMessage) {
    textParts.push(result.errorMessage);
  }
  const mergedText = textParts.join("\n\n").trim();
  const trimmed = mergedText
    ? trimCommandOutput(mergedText, maxOutputChars)
    : { text: "", truncated: false, originalChars: 0 };
  const pageUrl = mergedText.match(/^- Page URL:\s+(.+)$/mu)?.[1]?.trim();
  const pageTitle = mergedText.match(/^- Page Title:\s+(.+)$/mu)?.[1]?.trim();
  const blockedByInterstitial = typeof pageUrl === "string"
    && /\/sorry\//iu.test(pageUrl);
  return {
    text: trimmed.text || undefined,
    truncated: trimmed.truncated,
    imageUrls,
    imageCount: imageUrls.length,
    pageUrl,
    pageTitle,
    blockedByInterstitial,
  };
}

export function mergeBrowserPlaywrightToolResults(
  primary: NormalizedBrowserPlaywrightToolResult,
  extra: NormalizedBrowserPlaywrightToolResult | undefined,
  maxOutputChars: number,
): NormalizedBrowserPlaywrightToolResult {
  if (!extra) {
    return primary;
  }
  const mergedText = [
    primary.text,
    extra.text ? `### Post-navigation snapshot\n${extra.text}` : undefined,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).join("\n\n");
  const trimmed = mergedText
    ? trimCommandOutput(mergedText, maxOutputChars)
    : { text: "", truncated: false, originalChars: 0 };
  const imageUrls = [...new Set([...primary.imageUrls, ...extra.imageUrls])];
  return {
    text: trimmed.text || undefined,
    truncated: trimmed.truncated || primary.truncated || extra.truncated,
    imageUrls,
    imageCount: imageUrls.length,
    pageUrl: primary.pageUrl ?? extra.pageUrl,
    pageTitle: primary.pageTitle ?? extra.pageTitle,
    blockedByInterstitial: primary.blockedByInterstitial || extra.blockedByInterstitial,
  };
}

export async function maybeCaptureBrowserPlaywrightPostNavigateSnapshot(
  session: BrowserPlaywrightSessionLike,
  input: NormalizedBrowserPlaywrightInput,
): Promise<NormalizedBrowserPlaywrightToolResult | undefined> {
  if (input.action !== "navigate") {
    return undefined;
  }
  const snapshot = await session.call({
    toolName: "browser_snapshot",
    arguments: {},
  });
  if (snapshot.isError) {
    return undefined;
  }
  return normalizeBrowserPlaywrightToolResult(snapshot, input.maxOutputChars);
}

export async function maybeRecoverBrowserPlaywrightInterstitial(
  session: BrowserPlaywrightSessionLike,
  input: NormalizedBrowserPlaywrightInput,
): Promise<NormalizedBrowserPlaywrightToolResult | undefined> {
  if (input.action !== "navigate") {
    return undefined;
  }
  const waitResult = await session.call({
    toolName: "browser_wait_for",
    arguments: { time: 3 },
  });
  if (waitResult.isError) {
    return undefined;
  }
  const snapshot = await session.call({
    toolName: "browser_snapshot",
    arguments: {},
  });
  if (snapshot.isError) {
    return undefined;
  }
  return normalizeBrowserPlaywrightToolResult(snapshot, input.maxOutputChars);
}

export function buildBrowserPlaywrightSessionFingerprint(
  input: NormalizedBrowserPlaywrightInput,
): string {
  return JSON.stringify({
    headless: input.headless,
    browser: input.browser,
    isolated: input.isolated,
  });
}
