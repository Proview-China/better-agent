import { spawn, type ChildProcessByStdio } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";

import { loadLiveProviderConfig } from "./live-config.js";
import { rax } from "./runtime.js";

interface SmokeRow {
  name: string;
  status: "pass" | "fail" | "blocked";
  details: string;
}

const PLAYWRIGHT_MCP_ARGS = [
  "-y",
  "@playwright/mcp@latest",
  "--headless",
  "--isolated",
  "--output-mode",
  "stdout",
  "--browser",
  "chrome"
];

type PlaywrightHttpProcess = ChildProcessByStdio<null, Readable, Readable>;

function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a free TCP port."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForServerReady(
  proc: PlaywrightHttpProcess,
  port: number
): Promise<void> {
  const target = `http://localhost:${port}`;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for Playwright MCP HTTP server on ${target}.`));
    }, 20000);

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.off("data", onData);
      proc.stderr.off("data", onData);
      proc.off("exit", onExit);
    }

    function onData(chunk: Buffer) {
      const text = chunk.toString("utf8");
      if (text.includes(`Listening on ${target}`)) {
        cleanup();
        resolve();
      }
    }

    function onExit(code: number | null, signal: NodeJS.Signals | null) {
      cleanup();
      reject(new Error(`Playwright MCP HTTP server exited before becoming ready (code=${code}, signal=${signal}).`));
    }

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", onExit);
  });
}

async function startPlaywrightHttpServer(): Promise<{
  port: number;
  process: PlaywrightHttpProcess;
}> {
  const port = await allocatePort();
  const process = spawn(
    "npx",
    [
      ...PLAYWRIGHT_MCP_ARGS,
      "--host",
      "localhost",
      "--port",
      String(port)
    ],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  await waitForServerReady(process, port);

  return {
    port,
    process
  };
}

async function stopPlaywrightHttpServer(
  process: PlaywrightHttpProcess
): Promise<void> {
  if (process.exitCode !== null) {
    return;
  }

  process.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => process.once("exit", () => resolve())),
    sleep(3000).then(() => {
      if (process.exitCode === null) {
        process.kill("SIGKILL");
      }
    })
  ]);
}

function extractOpenAIText(response: unknown): string {
  if (typeof response === "object" && response !== null && "finalOutput" in response) {
    const text = (response as { finalOutput?: unknown }).finalOutput;
    return typeof text === "string" ? text.trim() : "";
  }

  if (typeof response === "object" && response !== null && "output_text" in response) {
    const text = (response as { output_text?: unknown }).output_text;
    return typeof text === "string" ? text.trim() : "";
  }
  return "";
}

function extractAnthropicText(response: unknown): string {
  if (
    typeof response === "object" &&
    response !== null &&
    "content" in response &&
    Array.isArray((response as { content?: unknown }).content)
  ) {
    return ((response as { content: Array<{ type?: string; text?: string }> }).content)
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text ?? "")
      .join("\n")
      .replace(/\*/gu, "")
      .trim();
  }
  return "";
}

function extractDeepMindText(response: unknown): string {
  if (typeof response === "object" && response !== null && "finalOutput" in response) {
    const text = (response as { finalOutput?: unknown }).finalOutput;
    return typeof text === "string" ? text.trim() : "";
  }
  return "";
}

async function smokeOpenAI(httpUrl: string): Promise<SmokeRow> {
  const config = loadLiveProviderConfig();
  const candidates = Array.from(new Set([config.openai.model, "gpt-5.4"]));
  let lastError: unknown;

  for (const model of candidates) {
    try {
      const base = rax.generate.create({
        provider: "openai",
        model,
        input: {
          input: "Use the MCP tools to open https://example.com and answer with only the page title."
        }
      });

      const native = rax.mcp.native.build({
        provider: "openai",
        model,
        layer: "api",
        input: {
          connectionId: "openai-native-live-smoke",
          transport: {
            kind: "streamable-http",
            url: httpUrl
          }
        }
      });

      const result = await rax.mcp.native.composeAndExecute(base as never, native);
      const text = extractOpenAIText(result);
      return text === "Example Domain"
        ? {
            name: "openai:native:responses+mcp",
            status: "pass",
            details: `model ${model} final answer: ${text}`
          }
        : {
            name: "openai:native:responses+mcp",
            status: "fail",
            details: `model ${model} returned unexpected answer: ${text || "<empty>"}`
          };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    name: "openai:native:responses+mcp",
    status:
      String(lastError).includes("502") || String(lastError).includes("Bad gateway")
        ? "blocked"
        : "fail",
    details: lastError instanceof Error ? lastError.message : String(lastError)
  };
}

async function smokeOpenAIAgent(): Promise<SmokeRow> {
  const config = loadLiveProviderConfig();
  const candidates = Array.from(new Set([config.openai.model, "gpt-5.4"]));
  let lastError: unknown;

  for (const model of candidates) {
    try {
      const base = rax.generate.create({
        provider: "openai",
        model,
        input: {
          input: "Use the MCP tools to open https://example.com and answer with only the page title."
        }
      });

      const native = rax.mcp.native.build({
        provider: "openai",
        model,
        layer: "agent",
        input: {
          connectionId: "openai-agent-native-live-smoke",
          transport: {
            kind: "stdio",
            command: "npx",
            args: PLAYWRIGHT_MCP_ARGS
          }
        }
      });

      const result = await rax.mcp.native.composeAndExecute(base as never, native);
      const text = extractOpenAIText(result);
      return text === "Example Domain"
        ? {
            name: "openai:native:agents+stdio",
            status: "pass",
            details: `model ${model} final answer: ${text}`
          }
        : {
            name: "openai:native:agents+stdio",
            status: "fail",
            details: `model ${model} returned unexpected answer: ${text || "<empty>"}`
          };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    name: "openai:native:agents+stdio",
    status:
      String(lastError).includes("502") || String(lastError).includes("Bad gateway")
        ? "blocked"
        : "fail",
    details: lastError instanceof Error ? lastError.message : String(lastError)
  };
}

async function smokeAnthropic(httpUrl: string): Promise<SmokeRow> {
  const config = loadLiveProviderConfig();
  if (httpUrl.startsWith("http://localhost")) {
    return {
      name: "anthropic:native:messages+mcp",
      status: "blocked",
      details: "Anthropic MCP connector requires a publicly exposed HTTPS MCP server; localhost HTTP is not a valid final baseline."
    };
  }
  const candidates = [
    config.anthropic.model,
    "claude-opus-4-6-thinking",
    "claude-sonnet-4-6"
  ];

  let lastError: unknown;

  for (const model of candidates) {
    try {
      const base = rax.generate.create({
        provider: "anthropic",
        model,
        input: {
          maxTokens: 128,
          messages: [{ role: "user", content: "Use the MCP tools to open https://example.com and answer with only the page title." }]
        }
      });

      const native = rax.mcp.native.build({
        provider: "anthropic",
        model,
        layer: "api",
        input: {
          connectionId: "anthropic-native-live-smoke",
          transport: {
            kind: "streamable-http",
            url: httpUrl
          }
        }
      });

      const result = await rax.mcp.native.composeAndExecute(base as never, native);
      const text = extractAnthropicText(result);
      return text === "Example Domain"
        ? {
            name: "anthropic:native:messages+mcp",
            status: "pass",
            details: `model ${model} final answer: ${text}`
          }
        : {
            name: "anthropic:native:messages+mcp",
            status: "fail",
            details: `model ${model} returned unexpected answer: ${text || "<empty>"}`
          };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    name: "anthropic:native:messages+mcp",
    status: "fail",
    details: lastError instanceof Error ? lastError.message : String(lastError)
  };
}

async function smokeAnthropicAgent(): Promise<SmokeRow> {
  const config = loadLiveProviderConfig();
  const candidates = [
    config.anthropic.model,
    "claude-opus-4-6-thinking",
    "claude-sonnet-4-6"
  ];

  let lastError: unknown;

  for (const model of candidates) {
    try {
      const base = rax.generate.create({
        provider: "anthropic",
        model,
        input: {
          maxTokens: 128,
          messages: [{ role: "user", content: "Use the MCP tools to open https://example.com and answer with only the page title." }]
        }
      });

      const native = rax.mcp.native.build({
        provider: "anthropic",
        model,
        layer: "agent",
        input: {
          transport: {
            kind: "stdio",
            command: "npx",
            args: PLAYWRIGHT_MCP_ARGS
          }
        }
      });

      const result = await rax.mcp.native.composeAndExecute(base as never, native);
      const text = extractAnthropicText(result);
      return text === "Example Domain"
        ? {
            name: "anthropic:native:agent+stdio",
            status: "pass",
            details: `model ${model} final answer: ${text}`
          }
        : {
            name: "anthropic:native:agent+stdio",
            status: "fail",
            details: `model ${model} returned unexpected answer: ${text || "<empty>"}`
          };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    name: "anthropic:native:agent+stdio",
    status:
      String(lastError).includes("Not logged in") || String(lastError).includes("/login")
        ? "blocked"
        : "fail",
    details: lastError instanceof Error ? lastError.message : String(lastError)
  };
}

async function smokeDeepMindAgent(): Promise<SmokeRow> {
  const config = loadLiveProviderConfig();
  const candidates = Array.from(new Set([config.deepmind.model, "gemini-2.5-flash", "gemini-2.5-pro"]));
  let lastError: unknown;
  let lastUnexpected: string | undefined;

  for (const model of candidates) {
    try {
      const base = rax.generate.create({
        provider: "deepmind",
        model,
        input: {
          contents: "Use the MCP tools to open https://example.com and answer with only the page title."
        }
      });

      const native = rax.mcp.native.build({
        provider: "deepmind",
        model,
        layer: "agent",
        input: {
          transport: {
            kind: "stdio",
            command: "npx",
            args: PLAYWRIGHT_MCP_ARGS
          }
        }
      });

      const result = await rax.mcp.native.composeAndExecute(base as never, native);
      const text = extractDeepMindText(result);
      if (text === "Example Domain") {
        return {
          name: "deepmind:native:agent+stdio",
          status: "pass",
          details: `model ${model} final answer: ${text}`
        };
      }

      lastUnexpected = `model ${model} returned unexpected answer: ${text || "<empty>"}`;
    } catch (error) {
      lastError = error;
    }
  }

  return {
    name: "deepmind:native:agent+stdio",
    status: "fail",
    details: lastUnexpected ?? (lastError instanceof Error ? lastError.message : String(lastError))
  };
}

async function main(): Promise<void> {
  const httpServer = await startPlaywrightHttpServer();

  try {
    const httpUrl = `http://localhost:${httpServer.port}/mcp`;
    const results = [
      await smokeOpenAI(httpUrl),
      await smokeOpenAIAgent(),
      await smokeAnthropic(httpUrl),
      await smokeAnthropicAgent(),
      await smokeDeepMindAgent()
    ];

    for (const result of results) {
      console.log(`[${result.status.toUpperCase()}] ${result.name}: ${result.details}`);
    }

    const failed = results.filter((result) => result.status === "fail");
    process.exit(failed.length > 0 ? 1 : 0);
  } finally {
    await stopPlaywrightHttpServer(httpServer.process).catch(() => undefined);
  }
}

await main();
