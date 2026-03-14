import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface OpenAILiveConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  reasoningEffort?: string;
}

export interface AnthropicLiveConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface DeepMindLiveConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface LiveProviderConfig {
  openai: OpenAILiveConfig;
  anthropic: AnthropicLiveConfig;
  anthropicAlt?: AnthropicLiveConfig;
  deepmind: DeepMindLiveConfig;
}

function normalizeOpenAIBaseURL(input: string): string {
  const url = new URL(input);
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/v1";
  }
  return url.toString().replace(/\/$/u, "");
}

function parseEnvFile(filePath: string): Record<string, string> {
  const contents = readFileSync(filePath, "utf8");
  const variables: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    variables[key] = value;
  }

  return variables;
}

function requireField(source: Record<string, string>, field: string): string {
  const value = source[field];
  if (!value) {
    throw new Error(`Missing required live smoke config field: ${field}`);
  }
  return value;
}

export function loadLiveProviderConfig(
  envPath = resolve(process.cwd(), ".env.local")
): LiveProviderConfig {
  const values = parseEnvFile(envPath);

  const anthropicAltConfigured =
    values.ANTHROPIC_ALT_API_KEY !== undefined &&
    values.ANTHROPIC_ALT_BASE_URL !== undefined &&
    values.ANTHROPIC_ALT_MODEL !== undefined;

  return {
    openai: {
      apiKey: requireField(values, "OPENAI_API_KEY"),
      baseURL: normalizeOpenAIBaseURL(requireField(values, "OPENAI_BASE_URL")),
      model: requireField(values, "OPENAI_MODEL"),
      reasoningEffort: values.OPENAI_REASONING_EFFORT
    },
    anthropic: {
      apiKey: requireField(values, "ANTHROPIC_API_KEY"),
      baseURL: requireField(values, "ANTHROPIC_BASE_URL"),
      model: requireField(values, "ANTHROPIC_MODEL")
    },
    anthropicAlt: anthropicAltConfigured
      ? {
          apiKey: requireField(values, "ANTHROPIC_ALT_API_KEY"),
          baseURL: requireField(values, "ANTHROPIC_ALT_BASE_URL"),
          model: requireField(values, "ANTHROPIC_ALT_MODEL")
        }
      : undefined,
    deepmind: {
      apiKey: requireField(values, "DEEPMIND_API_KEY"),
      baseURL: requireField(values, "DEEPMIND_BASE_URL"),
      model: requireField(values, "DEEPMIND_MODEL")
    }
  };
}
