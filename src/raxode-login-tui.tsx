import { Box, render, Text, useApp, useInput, type Key } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import stringWidth from "string-width";

import { TUI_THEME } from "./agent_core/tui-theme.js";
import {
  applyTuiTextInputKey,
  createTuiTextInputState,
  renderTuiTextInputCursor,
  type TuiTextInputState,
} from "./agent_core/tui-input/text-input.js";
import { loadOpenAILiveConfig } from "./rax/live-config.js";
import { EMBEDDING_MODEL_CATALOG, listAvailableChatModels, probeEmbeddingModelAvailability } from "./agent_core/tui-input/model-catalog.js";
import {
  loginOpenAIWithBrowser,
  loginOpenAIWithDeviceCode,
  type OpenAILoginProgressCallbacks,
} from "./raxcode-openai-auth.js";
import {
  applyAnthropicEndpointLoginConfig,
  applyChatGptSubscriptionRoleRouting,
  applyEmbeddingLoginConfig,
  type OpenAICompatibleRouteKind,
  applyOpenAICompatibleApiLoginConfig,
  listAvailableAnthropicModels,
  maskSecretForDisplay,
} from "./raxode-login-wizard.js";
import { loadRaxcodeAuthFile, loadRaxcodeConfigFile, loadResolvedEmbeddingConfig } from "./raxcode-config.js";

type LoginPage =
  | { kind: "method" }
  | { kind: "chatgpt-method" }
  | { kind: "openai-route" }
  | { kind: "openai-config" }
  | { kind: "anthropic-config" }
  | { kind: "login-progress"; lines: string[]; cancelTarget: "chatgpt-method" }
  | { kind: "success"; message: string; next: "embedding" }
  | { kind: "embedding-config" }
  | { kind: "final"; skippedEmbedding: boolean };

type MethodOption = "chatgpt" | "openai" | "anthropic";
type ChatGptMethodOption = "web-login" | "device-auth";
type OpenAIRouteOption = OpenAICompatibleRouteKind;
type OpenAIFieldId = "baseURL" | "apiKey";
type AnthropicFieldId = "baseURL" | "apiKey";
type EmbeddingFieldId = "baseURL" | "apiKey";

const STARTUP_WORD = "RAXODE";
const STARTUP_ANIMATION_INTERVAL_MS = 200;
const STARTUP_RAINBOW_BASE_COLORS = [
  "redBright",
  "yellow",
  "yellowBright",
  "greenBright",
  "cyanBright",
  "magenta",
  "magentaBright",
] as const;
const STARTUP_RAINBOW_COLORS = [
  ...STARTUP_RAINBOW_BASE_COLORS,
  ...STARTUP_RAINBOW_BASE_COLORS,
  ...STARTUP_RAINBOW_BASE_COLORS,
  "magentaBright",
] as const;
const STARTUP_LETTER_ART: Record<string, string[]> = {
  R: [
    "██████╗ ",
    "██╔══██╗",
    "██████╔╝",
    "██╔══██╗",
    "██║  ██║",
    "╚═╝  ╚═╝",
  ],
  A: [
    " █████╗ ",
    "██╔══██╗",
    "███████║",
    "██╔══██║",
    "██║  ██║",
    "╚═╝  ╚═╝",
  ],
  X: [
    "██╗  ██╗",
    "╚██╗██╔╝",
    " ╚███╔╝ ",
    " ██╔██╗ ",
    "██╔╝ ██╗",
    "╚═╝  ╚═╝",
  ],
  O: [
    " ██████╗ ",
    "██╔═══██╗",
    "██║   ██║",
    "██║   ██║",
    "╚██████╔╝",
    " ╚═════╝ ",
  ],
  D: [
    "██████╗ ",
    "██╔══██╗",
    "██║  ██║",
    "██║  ██║",
    "██████╔╝",
    "╚═════╝ ",
  ],
  E: [
    "███████╗",
    "██╔════╝",
    "█████╗  ",
    "██╔══╝  ",
    "███████╗",
    "╚══════╝",
  ],
};

interface HeaderLine {
  segments: Array<{ text: string; color?: string }>;
}

interface LoginAppProps {
  fallbackDir?: string;
  onExit: () => void;
}

function shouldBeginInlineEditing(inputText: string, key: Key): boolean {
  if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.escape || key.return) {
    return false;
  }
  return inputText.length > 0 || key.backspace || key.delete || (key.ctrl && inputText === "u");
}

function buildAnimatedStartupHeader(step: number): HeaderLine[] {
  const visibleLetters = STARTUP_WORD.slice(0, Math.max(0, Math.min(step, STARTUP_WORD.length))).split("");
  const rows = Array.from({ length: 6 }, () => [] as Array<{ text: string; color?: string }>);
  const highlightedLetterIndex =
    step > 0 && step <= STARTUP_WORD.length
      ? visibleLetters.length - 1
      : -1;
  const showPoweredBy = step >= STARTUP_WORD.length;
  const rainbowIndex = Math.max(0, Math.min(
    STARTUP_RAINBOW_COLORS.length - 1,
    step - STARTUP_WORD.length,
  ));

  visibleLetters.forEach((letter, letterIndex) => {
    const glyph = STARTUP_LETTER_ART[letter];
    if (!glyph) {
      return;
    }
    const color = letterIndex === highlightedLetterIndex ? TUI_THEME.violet : undefined;
    for (let index = 0; index < rows.length; index += 1) {
      rows[index].push({
        text: `${glyph[index]} `,
        color,
      });
    }
  });

  if (showPoweredBy) {
    rows[0].push({ text: "powered by ", color: TUI_THEME.textMuted });
    rows[0].push({ text: "Praxis", color: STARTUP_RAINBOW_COLORS[rainbowIndex] });
  }

  if (step > STARTUP_WORD.length) {
    rows[5].push({
      text: "v0.1.0",
      color: TUI_THEME.textMuted,
    });
  }

  return rows.map((segments) => ({ segments }));
}

function renderHeaderLines(lines: HeaderLine[]): React.ReactNode {
  return lines.map((line, lineIndex) => (
    <Text key={`header:${lineIndex}`}>
      {line.segments.map((segment, segmentIndex) => (
        <Text key={`header:${lineIndex}:${segmentIndex}`} color={segment.color}>
          {segment.text}
        </Text>
      ))}
    </Text>
  ));
}

function formatInputFieldLine(
  label: string,
  state: TuiTextInputState,
  options: {
    active: boolean;
    editing: boolean;
    secret?: boolean;
    suffix?: string;
  },
): React.ReactNode {
  const prefix = options.active ? "→  " : "   ";
  if (options.secret) {
    const masked = state.value.length > 0 ? maskSecretForDisplay(state.value) : " ";
    return (
      <Text>
        <Text color={options.active ? TUI_THEME.yellow : TUI_THEME.textMuted}>{prefix}</Text>
        <Text color={TUI_THEME.text}>{label}</Text>
        <Text color={TUI_THEME.text}>[ </Text>
        <Text color={options.editing ? TUI_THEME.yellow : TUI_THEME.text}>{masked}</Text>
        <Text color={options.editing ? TUI_THEME.yellow : TUI_THEME.text}>{options.editing ? "█" : ""}</Text>
        <Text color={TUI_THEME.text}> ]</Text>
        {options.suffix ? <Text color={TUI_THEME.textMuted}>{options.suffix}</Text> : null}
      </Text>
    );
  }
  const rendered = renderTuiTextInputCursor(state);
  const visibleBefore = rendered.before.length > 0 ? rendered.before : "";
  const visibleCursor = options.editing ? rendered.cursor : "";
  const visibleAfter = options.editing ? rendered.after : state.value;
  return (
    <Text>
      <Text color={options.active ? TUI_THEME.yellow : TUI_THEME.textMuted}>{prefix}</Text>
      <Text color={TUI_THEME.text}>{label}</Text>
      <Text color={TUI_THEME.text}>[ </Text>
      {options.editing ? (
        <>
          <Text color={TUI_THEME.text}>{visibleBefore}</Text>
          <Text color={TUI_THEME.yellow}>{visibleCursor || " "}</Text>
          <Text color={TUI_THEME.text}>{visibleAfter}</Text>
        </>
      ) : (
        <Text color={TUI_THEME.text}>{state.value || " "}</Text>
      )}
      <Text color={TUI_THEME.text}> ]</Text>
      {options.suffix ? <Text color={TUI_THEME.textMuted}>{options.suffix}</Text> : null}
    </Text>
  );
}

async function fetchChatModelAvailability(kind: MethodOption, fallbackDir: string): Promise<void> {
  if (kind === "anthropic") {
    const config = loadRaxcodeConfigFile(fallbackDir);
    const auth = loadRaxcodeAuthFile(fallbackDir);
    const profile = config.profiles.find((entry) => entry.id === "profile.provider.anthropic.default");
    const authProfile = auth.authProfiles.find((entry) => entry.id === "auth.anthropic.default");
    if (!profile || !authProfile?.credentials.apiKey) {
      return;
    }
    await listAvailableAnthropicModels(profile.route.baseURL, authProfile.credentials.apiKey);
    return;
  }
  await listAvailableChatModels(loadOpenAILiveConfig("core.main"));
}

async function fetchEmbeddingAvailability(fallbackDir: string): Promise<void> {
  const embeddingConfig = loadResolvedEmbeddingConfig(fallbackDir);
  if (!embeddingConfig) {
    return;
  }
  for (const entry of EMBEDDING_MODEL_CATALOG) {
    await probeEmbeddingModelAvailability(entry.id as typeof embeddingConfig.model, embeddingConfig);
  }
}

function LoginApp({ fallbackDir = process.cwd(), onExit }: LoginAppProps): React.ReactElement {
  const { exit } = useApp();
  const [startupStep, setStartupStep] = useState(0);
  const [page, setPage] = useState<LoginPage>({ kind: "method" });
  const [methodIndex, setMethodIndex] = useState(0);
  const [chatGptMethodIndex, setChatGptMethodIndex] = useState(0);
  const [openAiRouteIndex, setOpenAiRouteIndex] = useState(0);
  const [openAiFieldIndex, setOpenAiFieldIndex] = useState(0);
  const [anthropicFieldIndex, setAnthropicFieldIndex] = useState(0);
  const [embeddingFieldIndex, setEmbeddingFieldIndex] = useState(0);
  const [editingField, setEditingField] = useState<OpenAIFieldId | AnthropicFieldId | EmbeddingFieldId | null>(null);
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState(createTuiTextInputState());
  const [openAiApiKey, setOpenAiApiKey] = useState(createTuiTextInputState());
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState(createTuiTextInputState());
  const [anthropicApiKey, setAnthropicApiKey] = useState(createTuiTextInputState());
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState(createTuiTextInputState());
  const [embeddingApiKey, setEmbeddingApiKey] = useState(createTuiTextInputState());
  const [currentMethod, setCurrentMethod] = useState<MethodOption>("chatgpt");
  const [currentOpenAiRoute, setCurrentOpenAiRoute] = useState<OpenAIRouteOption>("gpt_compatible");
  const loginInFlightRef = useRef(false);

  useEffect(() => {
    const maxStep = STARTUP_WORD.length + STARTUP_RAINBOW_COLORS.length;
    const timer = setInterval(() => {
      setStartupStep((previous) => (previous < maxStep ? previous + 1 : previous));
    }, STARTUP_ANIMATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (page.kind !== "success") {
      return;
    }
    const timer = setTimeout(() => {
      setPage({ kind: "embedding-config" });
      setEmbeddingFieldIndex(0);
      setEditingField(null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [page]);

  const methodOptions = [
    "Login with ChatGPT subscription",
    "Use OpenAI compatible api key",
    "Use Anthropic Endpoint api key",
  ] as const;
  const chatGptMethodOptions = ["web-login", "device-auth"] as const;
  const openAiRouteOptions = [
    "GPT Compatible (Responses API)",
    "Gemini Compatible (Chat Completions API)",
  ] as const;

  const exitApp = () => {
    onExit();
    exit();
  };

  const beginLoginProgress = async (method: ChatGptMethodOption) => {
    if (loginInFlightRef.current) {
      return;
    }
    loginInFlightRef.current = true;
    const lines: string[] = [];
    const callbacks: OpenAILoginProgressCallbacks = {
      onMessage: (message) => {
        lines.splice(0, lines.length, ...message.split(/\n/u));
        setPage({ kind: "login-progress", lines: [...lines], cancelTarget: "chatgpt-method" });
      },
    };
    setPage({ kind: "login-progress", lines: ["Starting login..."], cancelTarget: "chatgpt-method" });
    try {
      if (method === "web-login") {
        await loginOpenAIWithBrowser(fallbackDir, callbacks);
      } else {
        await loginOpenAIWithDeviceCode(fallbackDir, callbacks);
      }
      applyChatGptSubscriptionRoleRouting(fallbackDir);
      setCurrentMethod("chatgpt");
      setPage({ kind: "success", message: "ChatGPT Subscription Login Successful!", next: "embedding" });
    } catch (error) {
      setPage({
        kind: "login-progress",
        lines: [
          ...(lines.length > 0 ? lines : []),
          "",
          error instanceof Error ? error.message : String(error),
          "",
          "press ESC to return to previous page",
        ],
        cancelTarget: "chatgpt-method",
      });
    } finally {
      loginInFlightRef.current = false;
    }
  };

  const finalizeApiConfiguration = async (method: MethodOption) => {
    if (method === "openai") {
      applyOpenAICompatibleApiLoginConfig(openAiBaseUrl.value, openAiApiKey.value, fallbackDir, {
        routeKind: currentOpenAiRoute,
      });
      setCurrentMethod("openai");
      setPage({
        kind: "success",
        message: currentOpenAiRoute === "gemini_compatible"
          ? "Gemini Compatible API Configuration Successful!"
          : "GPT Compatible API Configuration Successful!",
        next: "embedding",
      });
      return;
    }
    applyAnthropicEndpointLoginConfig(anthropicBaseUrl.value, anthropicApiKey.value, fallbackDir);
    setCurrentMethod("anthropic");
    setPage({ kind: "success", message: "Anthropic Endpoint Model Configuration Successful!", next: "embedding" });
  };

  const finalizeEmbeddingConfiguration = async (skipped: boolean) => {
    try {
      applyEmbeddingLoginConfig(skipped ? null : {
        baseURL: embeddingBaseUrl.value,
        apiKey: embeddingApiKey.value,
      }, fallbackDir);
      await fetchChatModelAvailability(currentMethod, fallbackDir);
      if (!skipped) {
        await fetchEmbeddingAvailability(fallbackDir);
      }
      setPage({ kind: "final", skippedEmbedding: skipped });
    } catch (error) {
      setPage({
        kind: "login-progress",
        lines: [
          error instanceof Error ? error.message : String(error),
          "",
          "press ESC to return to the initial page",
        ],
        cancelTarget: "chatgpt-method",
      });
    }
  };

  const clearActiveField = (
    focusedField: OpenAIFieldId | AnthropicFieldId | EmbeddingFieldId,
    setBaseState: React.Dispatch<React.SetStateAction<TuiTextInputState>>,
    setSecretState: React.Dispatch<React.SetStateAction<TuiTextInputState>>,
  ) => {
    if (focusedField === "baseURL") {
      setBaseState(createTuiTextInputState());
      return;
    }
    setSecretState(createTuiTextInputState());
  };

  useInput((inputText, key) => {
    if (page.kind === "final") {
      exitApp();
      return;
    }

    if (page.kind === "login-progress") {
      if (key.escape && !loginInFlightRef.current) {
        setPage(page.cancelTarget === "chatgpt-method" ? { kind: "chatgpt-method" } : { kind: "method" });
      }
      return;
    }

    if (key.escape) {
      setEditingField(null);
      switch (page.kind) {
        case "method":
          exitApp();
          return;
        case "chatgpt-method":
        case "anthropic-config":
          setPage({ kind: "method" });
          return;
        case "openai-route":
          setPage({ kind: "method" });
          return;
        case "openai-config":
          setPage({ kind: "openai-route" });
          return;
        case "embedding-config":
          setPage({ kind: "method" });
          return;
        default:
          return;
      }
    }

    if (page.kind === "method") {
      if (key.upArrow) {
        setMethodIndex((previous) => Math.max(0, previous - 1));
        return;
      }
      if (key.downArrow) {
        setMethodIndex((previous) => Math.min(methodOptions.length - 1, previous + 1));
        return;
      }
      if (key.return) {
        if (methodIndex === 0) {
          setCurrentMethod("chatgpt");
          setPage({ kind: "chatgpt-method" });
        } else if (methodIndex === 1) {
          setCurrentMethod("openai");
          setPage({ kind: "openai-route" });
        } else {
          setCurrentMethod("anthropic");
          setPage({ kind: "anthropic-config" });
        }
      }
      return;
    }

    if (page.kind === "chatgpt-method") {
      if (key.upArrow) {
        setChatGptMethodIndex((previous) => Math.max(0, previous - 1));
        return;
      }
      if (key.downArrow) {
        setChatGptMethodIndex((previous) => Math.min(chatGptMethodOptions.length - 1, previous + 1));
        return;
      }
      if (key.return) {
        void beginLoginProgress(chatGptMethodOptions[chatGptMethodIndex]);
      }
      return;
    }

    if (page.kind === "openai-route") {
      if (key.upArrow) {
        setOpenAiRouteIndex((previous) => Math.max(0, previous - 1));
        return;
      }
      if (key.downArrow) {
        setOpenAiRouteIndex((previous) => Math.min(openAiRouteOptions.length - 1, previous + 1));
        return;
      }
      if (key.return) {
        setCurrentOpenAiRoute(openAiRouteIndex === 0 ? "gpt_compatible" : "gemini_compatible");
        setPage({ kind: "openai-config" });
      }
      return;
    }

    const handleFormPage = (
      fieldIndex: number,
      setFieldIndex: React.Dispatch<React.SetStateAction<number>>,
      baseState: TuiTextInputState,
      setBaseState: React.Dispatch<React.SetStateAction<TuiTextInputState>>,
      secretState: TuiTextInputState,
      setSecretState: React.Dispatch<React.SetStateAction<TuiTextInputState>>,
      pageKind: "openai-config" | "anthropic-config" | "embedding-config",
    ) => {
      const focusedField: OpenAIFieldId | AnthropicFieldId | EmbeddingFieldId = fieldIndex === 0 ? "baseURL" : "apiKey";
      const applyToFocusedField = (state: TuiTextInputState) => {
        if (focusedField === "baseURL") {
          setBaseState(state);
        } else {
          setSecretState(state);
        }
      };
      if (editingField === focusedField) {
        if (key.ctrl && inputText === "u") {
          clearActiveField(focusedField, setBaseState, setSecretState);
          return;
        }
        const inputResult = applyTuiTextInputKey(
          focusedField === "baseURL" ? baseState : secretState,
          inputText,
          key,
        );
        if (inputResult.submit) {
          if (focusedField === "baseURL") {
            setEditingField(null);
            return;
          }
          setEditingField(null);
          if (pageKind === "openai-config" && baseState.value.trim() && secretState.value.trim()) {
            void finalizeApiConfiguration("openai");
          } else if (pageKind === "anthropic-config" && baseState.value.trim() && secretState.value.trim()) {
            void finalizeApiConfiguration("anthropic");
          } else if (pageKind === "embedding-config") {
            if (!baseState.value.trim() && !secretState.value.trim()) {
              void finalizeEmbeddingConfiguration(true);
            } else if (baseState.value.trim() && secretState.value.trim()) {
              void finalizeEmbeddingConfiguration(false);
            }
          }
          return;
        }
        if (inputResult.handled) {
          applyToFocusedField(inputResult.nextState);
        }
        return;
      }

      if (key.ctrl && inputText === "u") {
        clearActiveField(focusedField, setBaseState, setSecretState);
        setEditingField(focusedField);
        return;
      }

      if (key.upArrow) {
        setFieldIndex((previous) => Math.max(0, previous - 1));
        return;
      }
      if (key.downArrow) {
        setFieldIndex((previous) => Math.min(1, previous + 1));
        return;
      }
      if (key.return) {
        if (
          pageKind === "embedding-config"
          && fieldIndex === 1
          && !baseState.value.trim()
          && !secretState.value.trim()
        ) {
          void finalizeEmbeddingConfiguration(true);
          return;
        }
        setEditingField(focusedField);
        return;
      }

      if (shouldBeginInlineEditing(inputText, key)) {
        const inputResult = applyTuiTextInputKey(
          focusedField === "baseURL" ? baseState : secretState,
          inputText,
          key,
        );
        if (inputResult.handled) {
          applyToFocusedField(inputResult.nextState);
          setEditingField(focusedField);
        }
      }
    };

    if (page.kind === "openai-config") {
      handleFormPage(openAiFieldIndex, setOpenAiFieldIndex, openAiBaseUrl, setOpenAiBaseUrl, openAiApiKey, setOpenAiApiKey, "openai-config");
      return;
    }
    if (page.kind === "anthropic-config") {
      handleFormPage(anthropicFieldIndex, setAnthropicFieldIndex, anthropicBaseUrl, setAnthropicBaseUrl, anthropicApiKey, setAnthropicApiKey, "anthropic-config");
      return;
    }
    if (page.kind === "embedding-config") {
      handleFormPage(embeddingFieldIndex, setEmbeddingFieldIndex, embeddingBaseUrl, setEmbeddingBaseUrl, embeddingApiKey, setEmbeddingApiKey, "embedding-config");
    }
  });

  const headerLines = useMemo(() => buildAnimatedStartupHeader(startupStep), [startupStep]);

  const pageBody = (() => {
    switch (page.kind) {
      case "method":
        return (
          <>
            <Text color={TUI_THEME.text}>Choose how you want to connect your model service.</Text>
            <Text> </Text>
            {methodOptions.map((option, index) => {
              const active = index === methodIndex;
              return (
                <Text key={`method:${option}`}>
                  <Text color={active ? TUI_THEME.yellow : TUI_THEME.textMuted}>{active ? "  →  " : "     "}</Text>
                  <Text color={active ? TUI_THEME.yellow : TUI_THEME.text}>{option}</Text>
                </Text>
              );
            })}
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>press ↑ to select up • press ↓ to select down</Text>
            <Text color={TUI_THEME.textMuted}>press ENTER to start configuring • press ESC to exit</Text>
          </>
        );
      case "chatgpt-method":
        return (
          <>
            <Text color={TUI_THEME.text}>ChatGPT Subscription Login</Text>
            <Text> </Text>
            {chatGptMethodOptions.map((option, index) => {
              const active = index === chatGptMethodIndex;
              return (
                <Text key={`chatgpt-method:${option}`}>
                  <Text color={active ? TUI_THEME.yellow : TUI_THEME.textMuted}>{active ? "     → " : "       "}</Text>
                  <Text color={active ? TUI_THEME.yellow : TUI_THEME.text}>{option}</Text>
                </Text>
              );
            })}
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>press ↑ to select up • press ↓ to select down</Text>
            <Text color={TUI_THEME.textMuted}>press ENTER to login with specified method</Text>
            <Text color={TUI_THEME.textMuted}>press ESC to return to previous page</Text>
          </>
        );
      case "openai-route":
        return (
          <>
            <Text color={TUI_THEME.text}>OpenAI Compatible Route Selection</Text>
            <Text> </Text>
            {openAiRouteOptions.map((option, index) => {
              const active = index === openAiRouteIndex;
              return (
                <Text key={`openai-route:${option}`}>
                  <Text color={active ? TUI_THEME.yellow : TUI_THEME.textMuted}>{active ? "  →  " : "     "}</Text>
                  <Text color={active ? TUI_THEME.yellow : TUI_THEME.text}>{option}</Text>
                </Text>
              );
            })}
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>press ↑ to select up • press ↓ to select down</Text>
            <Text color={TUI_THEME.textMuted}>press ENTER to start configuring • press ESC to return to previous page</Text>
          </>
        );
      case "openai-config":
        return (
          <>
            <Text color={TUI_THEME.text}>
              {currentOpenAiRoute === "gemini_compatible"
                ? "Gemini Compatible Model Configuration"
                : "GPT Compatible Model Configuration"}
            </Text>
            <Text> </Text>
            {formatInputFieldLine("openai_compatible_format_base_url: ", openAiBaseUrl, {
              active: openAiFieldIndex === 0,
              editing: editingField === "baseURL",
              suffix: currentOpenAiRoute === "gemini_compatible"
                ? " /v1/chat/completions"
                : " /v1/responses",
            })}
            {formatInputFieldLine("secret-api-key: ", openAiApiKey, {
              active: openAiFieldIndex === 1,
              editing: editingField === "apiKey",
              secret: true,
            })}
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>press ↑ to select up • press ↓ to select down</Text>
            <Text color={TUI_THEME.textMuted}>press ENTER to finish typing</Text>
            <Text color={TUI_THEME.textMuted}>press ESC to return to previous page</Text>
          </>
        );
      case "anthropic-config":
        return (
          <>
            <Text color={TUI_THEME.text}>Anthropic Endpoint Model Configuration</Text>
            <Text> </Text>
            {formatInputFieldLine("anthropic_format_base_url: ", anthropicBaseUrl, {
              active: anthropicFieldIndex === 0,
              editing: editingField === "baseURL",
              suffix: " /v1/messages",
            })}
            {formatInputFieldLine("secret-api-key: ", anthropicApiKey, {
              active: anthropicFieldIndex === 1,
              editing: editingField === "apiKey",
              secret: true,
            })}
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>press ↑ to select up • press ↓ to select down</Text>
            <Text color={TUI_THEME.textMuted}>press ENTER to finish typing</Text>
            <Text color={TUI_THEME.textMuted}>press ESC to return to previous page</Text>
          </>
        );
      case "login-progress":
        return (
          <>
            {page.lines.map((line, index) => (
              <Text key={`progress:${index}`} color={line.startsWith("http") ? TUI_THEME.violet : TUI_THEME.text}>
                {line || " "}
              </Text>
            ))}
          </>
        );
      case "success":
        return (
          <>
            <Text color={TUI_THEME.text}>{page.message}</Text>
          </>
        );
      case "embedding-config":
        return (
          <>
            <Text color={TUI_THEME.text}>Embedding Model Configuration</Text>
            <Text> </Text>
            {formatInputFieldLine("openai_compatible_format_base_url: ", embeddingBaseUrl, {
              active: embeddingFieldIndex === 0,
              editing: editingField === "baseURL",
              suffix: "/v1/embeddings",
            })}
            {formatInputFieldLine("secret-api-key: ", embeddingApiKey, {
              active: embeddingFieldIndex === 1,
              editing: editingField === "apiKey",
              secret: true,
            })}
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>NOTE: Leave blank to skip, but the memory pool feature cannot be used.</Text>
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>press ↑ to select up • press ↓ to select down</Text>
            <Text color={TUI_THEME.textMuted}>press ENTER to finish typing or skip</Text>
            <Text color={TUI_THEME.textMuted}>press ESC to return to the initial page</Text>
          </>
        );
      case "final":
        return (
          <>
            <Text color={TUI_THEME.text}>
              {page.skippedEmbedding ? "Embedding Model Configuration Skipped!" : "Embedding Model Configuration Successful!"}
            </Text>
            <Text color={TUI_THEME.text}>Now you can enjoy using Raxode!</Text>
            <Text> </Text>
            <Text color={TUI_THEME.text}>First switch to the directory where you want to work in.</Text>
            <Text color={TUI_THEME.text}>for example:   cd ~/example/sandbox/raxode_workspace</Text>
            <Text color={TUI_THEME.text}>then type:     raxode</Text>
            <Text> </Text>
            <Text color={TUI_THEME.textMuted}>Press any key to exit</Text>
          </>
        );
    }
  })();

  return (
    <Box flexDirection="column" paddingX={1}>
      {renderHeaderLines(headerLines)}
      <Text> </Text>
      {pageBody}
    </Box>
  );
}

export async function runRaxodeLoginTui(fallbackDir = process.cwd()): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const instance = render(
      <LoginApp
        fallbackDir={fallbackDir}
        onExit={() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }}
      />,
      {
        exitOnCtrlC: true,
      },
    );
    instance.waitUntilExit().then(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }).catch((error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });
  });
}
