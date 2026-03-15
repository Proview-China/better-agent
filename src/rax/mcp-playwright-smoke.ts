import assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";

import type { McpTransportConfig } from "./mcp-types.js";
import { rax } from "./runtime.js";

interface ProviderTarget {
  provider: "openai" | "anthropic" | "deepmind";
  model: string;
}

interface SmokeResult {
  transport: "stdio" | "streamable-http";
  provider: ProviderTarget["provider"];
  status: "pass" | "fail";
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

const PROVIDER_TARGETS: ProviderTarget[] = [
  { provider: "openai", model: "gpt-5" },
  { provider: "anthropic", model: "claude-opus-4-6-thinking" },
  { provider: "deepmind", model: "gemini-2.5-pro" }
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

async function bestEffort<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<void> {
  await Promise.race([
    promise.then(() => undefined),
    sleep(timeoutMs).then(() => undefined)
  ]).catch(() => undefined);
}

function extractTextContent(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .flatMap((item) => {
      if (typeof item === "object" && item !== null && "text" in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === "string" ? [text] : [];
      }
      return [];
    })
    .join("\n");
}

function buildSmokeTransport(
  transport: "stdio" | "streamable-http",
  httpServer?: { port: number; process: PlaywrightHttpProcess }
): McpTransportConfig {
  if (transport === "stdio") {
    return {
      kind: "stdio",
      command: "npx",
      args: PLAYWRIGHT_MCP_ARGS
    };
  }

  if (!httpServer) {
    throw new Error("HTTP Playwright MCP server is required for streamable-http smoke.");
  }

  return {
    kind: "streamable-http",
    url: `http://localhost:${httpServer.port}/mcp`
  };
}

async function runProviderSmoke(
  target: ProviderTarget,
  transport: "stdio" | "streamable-http"
): Promise<SmokeResult> {
  const connectionId = `playwright-${transport}-${target.provider}-${Date.now()}`;
  let session: Awaited<ReturnType<typeof rax.mcp.use>> | undefined;
  let httpServer: { port: number; process: PlaywrightHttpProcess } | undefined;

  try {
    if (transport === "streamable-http") {
      httpServer = await startPlaywrightHttpServer();
    }

    session = await rax.mcp.use({
      provider: target.provider,
      model: target.model,
      input: {
        connectionId,
        transport: buildSmokeTransport(transport, httpServer),
        metadata: {
          fixture: "playwright-mcp-smoke"
        }
      }
    });

    const tools = await session.tools();
    const toolNames = tools.tools.map((tool) => tool.name);

    assert.ok(
      toolNames.includes("browser_navigate"),
      `${target.provider} session did not expose browser_navigate.`
    );
    assert.ok(
      toolNames.includes("browser_snapshot"),
      `${target.provider} session did not expose browser_snapshot.`
    );

    await session.call({
      toolName: "browser_navigate",
      arguments: {
        url: "https://example.com"
      }
    });

    const snapshot = await session.call({
      toolName: "browser_snapshot",
      arguments: {}
    });
    const snapshotText = extractTextContent(snapshot.content);

    assert.match(snapshotText, /Example Domain/u);

    return {
      transport,
      provider: target.provider,
      status: "pass",
      details: `connected with layer ${session.connection.layer}, listed ${toolNames.length} tools, navigated to example.com and captured snapshot`
    };
  } catch (error) {
    return {
      transport,
      provider: target.provider,
      status: "fail",
      details: error instanceof Error ? error.message : String(error)
    };
  } finally {
    if (session) {
      await bestEffort(session.disconnect(), 3000);
    }
    if (httpServer) {
      await bestEffort(stopPlaywrightHttpServer(httpServer.process), 5000);
    }
  }
}

async function main(): Promise<void> {
  const results: SmokeResult[] = [];

  for (const transport of ["stdio", "streamable-http"] as const) {
    for (const target of PROVIDER_TARGETS) {
      results.push(await runProviderSmoke(target, transport));
    }
  }

  for (const result of results) {
    console.log(
      `[${result.status.toUpperCase()}] ${result.transport} ${result.provider}: ${result.details}`
    );
  }

  const failed = results.filter((result) => result.status === "fail");
  process.exit(failed.length > 0 ? 1 : 0);
}

await main();
