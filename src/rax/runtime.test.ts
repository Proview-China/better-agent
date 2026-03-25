import assert from "node:assert/strict";
import test from "node:test";

import type { OpenAIInvocationPayload } from "../integrations/openai/api/index.js";
import { CompatibilityBlockedError, RaxRoutingError, UnsupportedCapabilityError } from "./errors.js";
import { rax, raxLocal } from "./runtime.js";
import { WebSearchRuntime } from "./websearch-runtime.js";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function createLocalSkillFixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-runtime-skill-"));
  await mkdir(path.join(rootDir, "scripts"));
  await writeFile(
    path.join(rootDir, "SKILL.md"),
    `---
name: "Browser Worker"
description: >
  Handle browser automation workflows
metadata:
  version: "0.3.0"
---

Use this skill when browser automation is needed.
`,
    "utf8"
  );

  return rootDir;
}

test("default rax runtime routes OpenAI generate.create to Responses API by default", () => {
  const invocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    input: {
      input: "hello from rax"
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;

  assert.equal(invocation.adapterId, "openai.responses.generate.create");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(payload.surface, "responses");
});

test("default rax runtime can route OpenAI generate.create through compat variant", () => {
  const invocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    variant: "chat_completions_compat",
    input: {
      model: "gpt-5",
      messages: [{ role: "user", content: "compat please" }]
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;

  assert.equal(invocation.adapterId, "openai.chat_completions_compat.generate.create");
  assert.equal(invocation.variant, "chat_completions_compat");
  assert.equal(payload.surface, "chat_completions");
});

test("default rax runtime routes Anthropic generate.stream to Messages API", () => {
  const invocation = rax.generate.stream({
    provider: "anthropic",
    model: "claude-sonnet-4",
    input: {
      maxTokens: 256,
      messages: [{ role: "user", content: "stream this" }]
    }
  });
  const payload = invocation.payload as { stream: boolean };

  assert.equal(invocation.adapterId, "anthropic.api.generation.messages.stream");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(payload.stream, true);
});

test("default rax runtime routes Gemini embed.create to Gemini embedContent", () => {
  const invocation = rax.embed.create({
    provider: "deepmind",
    model: "gemini-embedding-001",
    input: {
      contents: "vectorize this"
    }
  });
  const payload = invocation.payload as { method: string };

  assert.equal(invocation.adapterId, "deepmind.api.embed.create.embed-content");
  assert.equal(invocation.sdk.packageName, "@google/genai");
  assert.equal(payload.method, "ai.models.embedContent");
});

test("default rax runtime rejects unsupported Anthropic embed.create", () => {
  assert.throws(
    () =>
      rax.embed.create({
        provider: "anthropic",
        model: "claude-sonnet-4",
        input: {
          text: "unsupported"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedCapabilityError);
      assert.equal(error.key, "embed.create");
      return true;
    }
  );
});

test("default rax runtime routes file.upload and batch.submit across providers", () => {
  const openAIFileUpload = rax.file.upload({
    provider: "openai",
    model: "gpt-5",
    input: {
      file: "demo.jsonl",
      purpose: "batch"
    }
  });

  const deepMindBatch = rax.batch.submit({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    input: {
      src: { inputUri: "gs://bucket/demo.jsonl" }
    }
  });
  const openAIPayload = openAIFileUpload.payload as OpenAIInvocationPayload<Record<string, unknown>>;
  const deepMindPayload = deepMindBatch.payload as { method: string };

  assert.equal(openAIFileUpload.adapterId, "openai.files.upload");
  assert.equal(openAIPayload.sdkMethodPath, "client.files.create");
  assert.equal(openAIPayload.surface, "files");
  assert.equal(deepMindBatch.adapterId, "deepmind.api.batch.submit.batches-create");
  assert.equal(deepMindPayload.method, "ai.batches.create");
});

test("default rax runtime routes OpenAI websearch.prepare to native Responses web_search", () => {
  const invocation = rax.websearch.prepare({
    provider: "openai",
    model: "gpt-5",
    input: {
      query: "latest OpenAI SDK search docs",
      goal: "Return a grounded answer with citations",
      allowedDomains: ["platform.openai.com"],
      blockedDomains: ["example.com"],
      maxSources: 2,
      maxOutputTokens: 128,
      citations: "required",
      searchContextSize: "high",
      userLocation: {
        city: "San Francisco",
        region: "CA",
        country: "US",
        timezone: "America/Los_Angeles"
      }
    }
  });
  const payload = invocation.payload as OpenAIInvocationPayload<Record<string, unknown>>;
  const params = payload.params as {
    include: string[];
    input: string;
    max_output_tokens: number;
    tools: Array<Record<string, unknown>>;
  };
  const webSearchTool = params.tools[0] as {
    type: string;
    filters?: {
      allowed_domains?: string[];
      blocked_domains?: string[];
    };
    search_context_size?: string;
    user_location?: {
      type?: string;
      city?: string;
      region?: string;
      country?: string;
      timezone?: string;
    };
  };

  assert.equal(invocation.adapterId, "openai.responses.search.ground");
  assert.equal(payload.surface, "responses");
  assert.deepEqual(params.include, ["web_search_call.action.sources"]);
  assert.equal(params.max_output_tokens, 128);
  assert.match(params.input, /Goal: Return a grounded answer with citations/u);
  assert.match(params.input, /Target no more than 2 distinct cited sources/u);
  assert.equal(webSearchTool.type, "web_search");
  assert.deepEqual(webSearchTool.filters, {
    allowed_domains: ["platform.openai.com"],
    blocked_domains: ["example.com"]
  });
  assert.equal(webSearchTool.search_context_size, "high");
  assert.deepEqual(webSearchTool.user_location, {
    type: "approximate",
    city: "San Francisco",
    region: "CA",
    country: "US",
    timezone: "America/Los_Angeles"
  });
});

test("default rax runtime routes Anthropic websearch.prepare to Claude Code agent search path", () => {
  const invocation = rax.websearch.prepare({
    provider: "anthropic",
    model: "claude-sonnet-4",
    input: {
      query: "Anthropic web search tool behavior",
      goal: "Return a grounded answer with citations",
      urls: ["https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool"],
      citations: "required"
    }
  });
  const payload = invocation.payload as {
    command: string;
    args: string[];
    prompt: string;
  };

  assert.equal(invocation.adapterId, "anthropic.agent.search.ground.claude-code");
  assert.equal(invocation.layer, "agent");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/claude-agent-sdk");
  assert.equal(payload.command, "claude");
  assert.deepEqual(payload.args, ["-p", "--model", "claude-sonnet-4", "--output-format", "json"]);
  assert.match(payload.prompt, /Primary query: Anthropic web search tool behavior/u);
  assert.match(payload.prompt, /Goal: Return a grounded answer with citations/u);
  assert.match(payload.prompt, /Known URLs to inspect if relevant:/u);
});

test("explicit Anthropic api websearch.prepare keeps server-tool route and carries governed task context", () => {
  const invocation = rax.websearch.prepare({
    provider: "anthropic",
    model: "claude-sonnet-4",
    layer: "api",
    input: {
      query: "Anthropic web search tool behavior",
      goal: "Return a grounded answer with citations",
      urls: ["https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool"],
      citations: "required"
    }
  });
  const payload = invocation.payload as {
    max_tokens: number;
    messages: Array<{ content: string }>;
    tools: Array<{ name?: string; type?: string }>;
  };

  assert.equal(invocation.adapterId, "anthropic.api.tools.search.ground");
  assert.equal(invocation.layer, "api");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(payload.max_tokens, 1024);
  assert.match(payload.messages[0]?.content ?? "", /Primary query: Anthropic web search tool behavior/u);
  assert.match(payload.messages[0]?.content ?? "", /Goal: Return a grounded answer with citations/u);
  assert.match(payload.messages[0]?.content ?? "", /Known URLs to inspect if relevant:/u);
  assert.match(payload.messages[0]?.content ?? "", /Citations are required in the final answer\./u);
  assert.deepEqual(
    payload.tools.map((tool) => tool.name),
    ["web_search", "web_fetch"]
  );
});

test("default rax runtime routes Gemini websearch.prepare to native generateContent search tools", () => {
  const invocation = rax.websearch.prepare({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      query: "Gemini grounding with Google Search",
      urls: ["https://ai.google.dev/gemini-api/docs/google-search"]
    }
  });
  const payload = invocation.payload as {
    method: string;
    params: {
      contents: string;
      config: {
        tools: Array<Record<string, unknown>>;
      };
    };
  };

  assert.equal(invocation.adapterId, "deepmind.api.search.ground.generate-content");
  assert.equal(payload.method, "ai.models.generateContent");
  assert.deepEqual(
    payload.params.config.tools,
    [{ googleSearch: {} }, { urlContext: {} }]
  );
});

test("Anthropic agent websearch runtime fails fast on Windows with a route-specific error", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-specific guard");
    return;
  }

  const runtime = new WebSearchRuntime();
  const result = await runtime.executePreparedInvocation(
    rax.websearch.prepare({
      provider: "anthropic",
      model: "claude-sonnet-4",
      input: {
        query: "Anthropic web search tool behavior",
        citations: "required"
      }
    })
  );

  assert.equal(result.status, "failed");
  const error = result.error as { code: string; message: string };
  assert.equal(error.code, "anthropic_agent_unavailable_on_windows");
  assert.match(error.message, /use layer: "api" on Windows/u);
});

test("default rax can compose OpenAI native MCP into a Responses prepared invocation", () => {
  const baseInvocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    input: {
      input: "hello from rax"
    }
  });

  const nativeInvocation = rax.mcp.native.build({
    provider: "openai",
    model: "gpt-5",
    layer: "api",
    input: {
      connectionId: "openai-compose",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  const composed = rax.mcp.native.compose(
    baseInvocation as never,
    nativeInvocation
  );
  const payload = composed.payload as unknown as OpenAIInvocationPayload<Record<string, unknown> & { tools?: Array<Record<string, unknown>> }>;

  assert.equal(composed.adapterId, "openai.responses.generate.create");
  assert.equal(payload.surface, "responses");
  assert.equal(payload.params.tools?.[0]?.type, "mcp");
});

test("default rax can compose Anthropic native MCP into a Messages prepared invocation", () => {
  const baseInvocation = rax.generate.create({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      maxTokens: 64,
      messages: [{ role: "user", content: "hello from rax" }]
    }
  });

  const nativeInvocation = rax.mcp.native.build({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    layer: "api",
    input: {
      connectionId: "anthropic-compose",
      transport: {
        kind: "streamable-http",
        url: "https://example.com/mcp"
      }
    }
  });

  const composed = rax.mcp.native.compose(
    baseInvocation as never,
    nativeInvocation
  );
  const payload = composed.payload as {
    mcp_servers?: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
  };

  assert.equal(composed.adapterId, "anthropic.api.generation.messages.create");
  assert.equal(payload.mcp_servers?.[0]?.type, "url");
  assert.equal(payload.tools?.[0]?.type, "mcp_toolset");
});

test("default rax can compose OpenAI agent-native MCP into an Agents run invocation", () => {
  const baseInvocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5",
    input: {
      input: "Use the MCP tools to open https://example.com and answer with only the page title."
    }
  });

  const nativeInvocation = rax.mcp.native.build({
    provider: "openai",
    model: "gpt-5",
    layer: "agent",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  const composed = rax.mcp.native.compose(
    baseInvocation as never,
    nativeInvocation
  );
  const payload = composed.payload as {
    prompt?: string;
    mcpServer?: { transport?: string };
  };

  assert.equal(composed.sdk.packageName, "@openai/agents");
  assert.equal(composed.sdk.entrypoint, "run");
  assert.equal(payload.prompt, "Use the MCP tools to open https://example.com and answer with only the page title.");
  assert.equal(payload.mcpServer?.transport, "stdio");
});

test("default rax rejects DeepMind native MCP compose as a static JSON merge", () => {
  const baseInvocation = rax.generate.create({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    input: {
      contents: "hello from rax"
    }
  });

  const nativeInvocation = rax.mcp.native.build({
    provider: "deepmind",
    model: "gemini-2.5-pro",
    layer: "api",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  assert.throws(
    () => rax.mcp.native.compose(baseInvocation as never, nativeInvocation),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "mcp_native_compose_unsupported");
      return true;
    }
  );
});

test("default rax can compose DeepMind agent-native MCP into an ADK runtime invocation", () => {
  const baseInvocation = rax.generate.create({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      contents: "Use the MCP tools to open https://example.com and answer with only the page title."
    }
  });

  const nativeInvocation = rax.mcp.native.build({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    layer: "agent",
    input: {
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--help"]
      }
    }
  });

  const composed = rax.mcp.native.compose(
    baseInvocation as never,
    nativeInvocation
  );
  const payload = composed.payload as {
    prompt?: string;
    toolset?: {
      connectionParams?: {
        connectionType?: string;
      };
    };
  };

  assert.equal(composed.sdk.packageName, "@google/adk");
  assert.equal(composed.sdk.entrypoint, "InMemoryRunner.runEphemeral");
  assert.equal(
    payload.prompt,
    "Use the MCP tools to open https://example.com and answer with only the page title."
  );
  assert.equal(payload.toolset?.connectionParams?.connectionType, "stdio");
});

test("raxLocal uses compatibility profile to default OpenAI generation to chat_completions_compat", () => {
  const invocation = raxLocal.generate.create({
    provider: "openai",
    model: "gpt-5",
    compatibilityProfileId: "openai-chat-only-gateway",
    input: {
      model: "gpt-5",
      messages: [{ role: "user", content: "compat gateway" }]
    }
  });

  assert.equal(invocation.adapterId, "openai.chat_completions_compat.generate.create");
  assert.equal(invocation.variant, "chat_completions_compat");
});

test("raxLocal websearch.create returns a blocked result on unofficial OpenAI-compatible gateway", async () => {
  const result = await raxLocal.websearch.create({
    provider: "openai",
    model: "gpt-5",
    compatibilityProfileId: "openai-chat-only-gateway",
    input: {
      query: "compat gateway should not imply official search"
    }
  });

  assert.equal(result.status, "blocked");
  const error = result.error as {
    code: string;
    message: string;
    raw: CompatibilityBlockedError;
  };
  assert.equal(error.code, "blocked_by_compatibility_profile");
  assert.match(error.message, /openai search\.ground is disabled by compatibility profile openai-chat-only-gateway\./u);
  const raw = error.raw;
  assert.ok(raw instanceof CompatibilityBlockedError);
  assert.equal(raw.key, "search.ground");
  assert.equal(raw.profileId, "openai-chat-only-gateway");
});

test("raxLocal blocks Anthropic file.upload on messages-only compatibility profile", () => {
  assert.throws(
    () =>
      raxLocal.file.upload({
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        compatibilityProfileId: "anthropic-messages-only-primary",
        input: {
          file: "demo.txt"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "file.upload");
      assert.equal(error.profileId, "anthropic-messages-only-primary");
      return true;
    }
  );
});

test("raxLocal blocks deepmind api MCP connect on unsupported model hints", async () => {
  await assert.rejects(
    () =>
      raxLocal.mcp.connect({
        provider: "deepmind",
        model: "gemini-3-flash",
        layer: "api",
        compatibilityProfileId: "deepmind-openai-compatible-gateway",
        input: {
          connectionId: "deepmind-gateway-unsupported-model",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest", "--help"]
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "mcp.connect");
      assert.equal(error.profileId, "deepmind-openai-compatible-gateway");
      return true;
    }
  );
});

test("raxLocal blocks OpenAI skill.list on chat-only gateway compatibility profile", () => {
  assert.throws(
    () =>
      raxLocal.skill.list({
        provider: "openai",
        model: "gpt-5",
        compatibilityProfileId: "openai-chat-only-gateway",
        input: {}
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "skill.list");
      assert.equal(error.profileId, "openai-chat-only-gateway");
      return true;
    }
  );
});

test("raxLocal blocks Anthropic skill.publish on messages-only compatibility profile", async () => {
  const rootDir = await createLocalSkillFixture();

  await assert.rejects(
    () =>
      raxLocal.skill.publish({
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        compatibilityProfileId: "anthropic-messages-only-primary",
        input: {
          source: rootDir
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "skill.create");
      assert.equal(error.profileId, "anthropic-messages-only-primary");
      return true;
    }
  );
});

test("raxLocal blocks DeepMind skill.list on openai-compatible gateway compatibility profile", () => {
  assert.throws(
    () =>
      raxLocal.skill.list({
        provider: "deepmind",
        model: "gemini-2.5-flash",
        compatibilityProfileId: "deepmind-openai-compatible-gateway",
        input: {}
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "skill.list");
      assert.equal(error.profileId, "deepmind-openai-compatible-gateway");
      return true;
    }
  );
});

test("default rax blocks anthropic api MCP stdio on the official compatibility profile", async () => {
  await assert.rejects(
    () =>
      rax.mcp.connect({
        provider: "anthropic",
        model: "claude-opus-4-6-thinking",
        layer: "api",
        input: {
          connectionId: "anthropic-api-stdio-blocked",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest", "--help"]
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "mcp.connect");
      assert.equal(error.profileId, "anthropic-default");
      return true;
    }
  );
});

test("default rax blocks openai api MCP resources surface on the official compatibility profile", async () => {
  await assert.rejects(
    () =>
      rax.mcp.listResources({
        provider: "openai",
        model: "gpt-5",
        layer: "api",
        input: {
          connectionId: "openai-api-missing"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "mcp.listResources");
      assert.equal(error.profileId, "openai-default");
      return true;
    }
  );
});

test("default rax blocks deepmind api MCP prompts surface on the official compatibility profile", async () => {
  await assert.rejects(
    () =>
      rax.mcp.listPrompts({
        provider: "deepmind",
        model: "gemini-2.5-pro",
        layer: "api",
        input: {
          connectionId: "deepmind-api-missing"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof CompatibilityBlockedError);
      assert.equal(error.key, "mcp.listPrompts");
      assert.equal(error.profileId, "deepmind-default");
      return true;
    }
  );
});

test("default rax skill.prepare emits an OpenAI SDK-ready shell invocation", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  const invocation = rax.skill.prepare({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container
    }
  });

  assert.equal(invocation.key, "skill.activate");
  assert.equal(invocation.adapterId, "skill.openai.openai-local-shell");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.responses.create");
  const payload = invocation.payload as {
    model: string;
    tools: Array<{
      type: string;
      environment: { skills: Array<{ path: string }> };
    }>;
  };
  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.skills[0]?.path, rootDir);
});

test("default rax skill.prepare emits an OpenAI hosted shell invocation with official attachment ids", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_001",
      attach_version: "7",
      version_id: "version_hosted_007"
    }
  });

  const invocation = rax.skill.prepare({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container: bound
    }
  });

  assert.equal(invocation.key, "skill.activate");
  assert.equal(invocation.adapterId, "skill.openai.openai-hosted-shell");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.responses.create");
  const payload = invocation.payload as {
    model: string;
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{ type: string; skill_id: string; version?: string }>;
      };
    }>;
  };
  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "container_auto");
  assert.equal(payload.tools[0]?.environment.skills[0]?.type, "skill_reference");
  assert.equal(payload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_001");
  assert.equal(payload.tools[0]?.environment.skills[0]?.version, "7");
});

test("default rax skill.prepare emits an OpenAI inline shell invocation", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-inline-shell",
    details: {
      source: {
        data: "UEsDBAoAAAAAAInlineSkillBundle",
        media_type: "application/zip",
        type: "base64"
      }
    }
  });

  const invocation = rax.skill.prepare({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container: bound
    }
  });

  const payload = invocation.payload as {
    model: string;
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{
          type: string;
          name: string;
          description: string;
          source: {
            data: string;
            media_type: string;
            type: string;
          };
        }>;
      };
    }>;
  };

  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "container_auto");
  assert.equal(payload.tools[0]?.environment.skills[0]?.type, "inline");
  assert.equal(payload.tools[0]?.environment.skills[0]?.name, container.descriptor.name);
  assert.equal(payload.tools[0]?.environment.skills[0]?.source.media_type, "application/zip");
  assert.equal(payload.tools[0]?.environment.skills[0]?.source.type, "base64");
});

test("default rax skill.prepare keeps OpenAI hosted attachment version separate from version resource metadata", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  const numericBound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_numeric",
      attach_version: 7
    }
  });
  const numericInvocation = rax.skill.prepare({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container: numericBound
    }
  });
  const numericPayload = numericInvocation.payload as {
    tools: Array<{
      environment: {
        skills: Array<{ skill_id: string; version?: string | number }>;
      };
    }>;
  };
  assert.equal(numericPayload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_numeric");
  assert.equal(numericPayload.tools[0]?.environment.skills[0]?.version, 7);

  const latestBound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_latest",
      attach_version: "latest"
    }
  });
  const latestInvocation = rax.skill.prepare({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container: latestBound
    }
  });
  const latestPayload = latestInvocation.payload as {
    tools: Array<{
      environment: {
        skills: Array<{ skill_id: string; version?: string | number }>;
      };
    }>;
  };
  assert.equal(latestPayload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_latest");
  assert.equal(latestPayload.tools[0]?.environment.skills[0]?.version, "latest");
});

test("default rax skill.prepare preserves official OpenAI hosted shell environment settings", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-hosted-shell",
    details: {
      skill_id: "skill_hosted_env_001",
      attach_version: 7,
      version_id: "version_hosted_007",
      environment: {
        file_ids: ["file_123"],
        memory_limit: "4g",
        network_policy: {
          type: "allowlist",
          allowed_domains: ["openai.com"]
        }
      }
    }
  });

  const invocation = rax.skill.prepare({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container: bound
    }
  });

  const payload = invocation.payload as {
    model: string;
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{ type: string; skill_id: string; version?: string | number }>;
        file_ids?: string[];
        memory_limit?: string | null;
        network_policy?: { type: string; allowed_domains?: string[] };
      };
    }>;
  };

  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.tools[0]?.environment.type, "container_auto");
  assert.equal(payload.tools[0]?.environment.skills[0]?.skill_id, "skill_hosted_env_001");
  assert.equal(payload.tools[0]?.environment.skills[0]?.version, 7);
  assert.deepEqual(payload.tools[0]?.environment.file_ids, ["file_123"]);
  assert.equal(payload.tools[0]?.environment.memory_limit, "4g");
  assert.deepEqual(payload.tools[0]?.environment.network_policy, {
    type: "allowlist",
    allowed_domains: ["openai.com"]
  });
});

test("default rax skill.prepare emits an Anthropic API-ready managed skill invocation", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "sk_browser_001"
    }
  });

  const invocation = rax.skill.prepare({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      container: bound
    }
  });

  assert.equal(invocation.adapterId, "skill.anthropic.anthropic-api-managed");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.messages.create");
  const payload = invocation.payload as {
    model: string;
    max_tokens: number;
    container: { skills: Array<{ skill_id: string; type: string; version?: string }> };
    tools: Array<{ type: string; name: string }>;
  };
  assert.equal(payload.model, "claude-opus-4-6-thinking");
  assert.equal(payload.max_tokens, 1024);
  assert.equal(payload.container.skills[0]?.skill_id, "sk_browser_001");
  assert.equal(payload.container.skills[0]?.type, "custom");
  assert.equal(payload.container.skills[0]?.version, undefined);
  assert.equal(payload.tools[0]?.name, "code_execution");
});

test("default rax skill.prepare emits a Google ADK-ready toolset invocation", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  const invocation = rax.skill.prepare({
    provider: "deepmind",
    model: "gemini-2.5-flash",
    input: {
      container
    }
  });

  assert.equal(invocation.adapterId, "skill.deepmind.google-adk-local");
  assert.equal(invocation.sdk.packageName, "@google/adk");
  assert.equal(invocation.sdk.entrypoint, "SkillToolset");
  const payload = invocation.payload as {
    toolset: {
      skills: Array<{ loader: string; path: string }>;
    };
  };
  assert.equal(payload.toolset.skills[0]?.loader, "load_skill_from_dir");
  assert.equal(payload.toolset.skills[0]?.path, rootDir);
});

test("default rax skill.use walks source to official carrier activation through one public action", async () => {
  const rootDir = await createLocalSkillFixture();

  const result = await rax.skill.use({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      source: rootDir
    }
  });

  assert.equal(result.container.descriptor.name, "Browser Worker");
  assert.equal(result.activation.officialCarrier, "openai-shell-environment");
  const payload = result.activation.payload as {
    tools: Array<{
      type: string;
      environment: {
        type: string;
        skills: Array<{ path: string }>;
      };
    }>;
  };
  assert.equal(payload.tools[0]?.type, "shell");
  assert.equal(payload.tools[0]?.environment.type, "local");
  assert.equal(payload.tools[0]?.environment.skills[0]?.path, rootDir);
  assert.equal(result.activation.composeStrategy, "payload-merge");
  assert.match(result.activation.composeNotes ?? "", /Responses generation requests/u);
  assert.equal(result.invocation.adapterId, "skill.openai.openai-local-shell");
  const invocationPayload = result.invocation.payload as {
    model: string;
  };
  assert.equal(invocationPayload.model, "gpt-5.4");
});

test("default rax skill.use can consume an existing container without recreating it from source", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  const result = await rax.skill.use({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container
    }
  });

  assert.equal(result.container.descriptor.id, container.descriptor.id);
  assert.equal(result.activation.officialCarrier, "openai-shell-environment");
  assert.equal(result.activation.composeStrategy, "payload-merge");
  const payload = result.invocation.payload as {
    model: string;
    tools: Array<{
      environment: {
        type: string;
        skills: Array<{ path: string }>;
      };
    }>;
  };
  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.tools[0]?.environment.type, "local");
  assert.equal(payload.tools[0]?.environment.skills[0]?.path, rootDir);
});

test("default rax skill.use can walk source to an OpenAI inline shell carrier", async () => {
  const rootDir = await createLocalSkillFixture();

  const result = await rax.skill.use({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      source: rootDir,
      mode: "openai-inline-shell",
      details: {
        source: {
          data: "UEsDBAoAAAAAAInlineSkillBundle",
          media_type: "application/zip",
          type: "base64"
        }
      }
    }
  });

  assert.equal(result.activation.officialCarrier, "openai-shell-environment");
  const activationPayload = result.activation.payload as {
    tools: Array<{
      environment: {
        type: string;
        skills: Array<{
          type: string;
          name: string;
          source: { data: string; media_type: string; type: string };
        }>;
      };
    }>;
  };
  assert.equal(activationPayload.tools[0]?.environment.type, "container_auto");
  assert.equal(activationPayload.tools[0]?.environment.skills[0]?.type, "inline");
  assert.equal(activationPayload.tools[0]?.environment.skills[0]?.name, result.container.descriptor.name);
  assert.equal(activationPayload.tools[0]?.environment.skills[0]?.source.data, "UEsDBAoAAAAAAInlineSkillBundle");
  assert.equal(result.invocation.adapterId, "skill.openai.openai-inline-shell");
});

test("default rax skill.compose merges an OpenAI prepared skill carrier into a Responses generation request", async () => {
  const rootDir = await createLocalSkillFixture();
  const baseInvocation = rax.generate.create({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      input: "Use the attached skill if needed and reply with only SKILL_OK."
    }
  });
  const skillResult = await rax.skill.use({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      source: rootDir
    }
  });

  const composed = rax.skill.compose(
    baseInvocation as never,
    skillResult
  );
  const payload = composed.payload as unknown as {
    surface: string;
    params: {
      input: string;
      tools: Array<{
        type: string;
        environment: {
          type: string;
          skills: Array<{ path: string }>;
        };
      }>;
    };
  };

  assert.equal(composed.adapterId, "openai.responses.generate.create");
  assert.equal(payload.surface, "responses");
  assert.equal(payload.params.input, "Use the attached skill if needed and reply with only SKILL_OK.");
  assert.equal(payload.params.tools[0]?.type, "shell");
  assert.equal(payload.params.tools[0]?.environment.type, "local");
  assert.equal(payload.params.tools[0]?.environment.skills[0]?.path, rootDir);
});

test("default rax skill.mount returns activation plus prepared invocation for an existing container", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });

  const result = rax.skill.mount({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      container
    }
  });

  assert.equal(result.container.descriptor.name, "Browser Worker");
  assert.equal(result.activation.officialCarrier, "anthropic-sdk-filesystem-skill");
  assert.equal(result.invocation.adapterId, "skill.anthropic.anthropic-sdk-filesystem");
  assert.equal(result.invocation.sdk.packageName, "@anthropic-ai/claude-agent-sdk");
  const payload = result.invocation.payload as {
    options: {
      cwd: string;
    };
  };
  assert.equal(payload.options.cwd, rootDir);
});

test("default rax skill.compose merges an Anthropic API-managed skill carrier into a Messages generation request", async () => {
  const rootDir = await createLocalSkillFixture();
  const baseInvocation = rax.generate.create({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      maxTokens: 256,
      messages: [{ role: "user", content: "Use the attached skill if needed and reply with only SKILL_OK." }],
      tools: [{ name: "existing_tool", type: "web_search_20260209" as const }]
    }
  });
  const skillResult = await rax.skill.use({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      source: rootDir,
      mode: "anthropic-api-managed",
      details: {
        skill_id: "sk_compose_api_managed",
        code_execution_type: "code_execution_20260120",
        betas: ["files-api-2025-04-14"]
      }
    }
  });

  const composed = rax.skill.compose(
    baseInvocation as never,
    skillResult
  );
  const payload = composed.payload as {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
    betas: string[];
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };

  assert.equal(composed.adapterId, "anthropic.api.generation.messages.create");
  assert.equal(payload.model, "claude-opus-4-6-thinking");
  assert.equal(payload.max_tokens, 256);
  assert.equal(payload.messages[0]?.content, "Use the attached skill if needed and reply with only SKILL_OK.");
  assert.deepEqual(payload.betas, [
    "files-api-2025-04-14",
    "code-execution-2026-01-20",
    "skills-2025-10-02"
  ]);
  assert.equal(payload.container.skills[0]?.skill_id, "sk_compose_api_managed");
  assert.equal(payload.tools[0]?.name, "existing_tool");
  assert.equal(payload.tools[1]?.type, "code_execution_20260120");
});

test("default rax skill.compose rejects Anthropic filesystem skill carriers until runtime-backed composition exists", async () => {
  const rootDir = await createLocalSkillFixture();
  const baseInvocation = rax.generate.create({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      maxTokens: 256,
      messages: [{ role: "user", content: "Use the attached skill if needed." }]
    }
  });
  const skillResult = await rax.skill.use({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      source: rootDir
    }
  });

  assert.throws(
    () => rax.skill.compose(baseInvocation as never, skillResult),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "skill_compose_unsupported");
      assert.match(error.message, /SDK runtime path/u);
      return true;
    }
  );
});

test("default rax skill.use can walk source to an Anthropic API-managed carrier", async () => {
  const rootDir = await createLocalSkillFixture();

  const result = await rax.skill.use({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      source: rootDir,
      mode: "anthropic-api-managed",
      details: {
        skill_id: "sk_use_api_managed",
        code_execution_type: "code_execution_20260120",
        betas: ["files-api-2025-04-14"]
      }
    }
  });

  assert.equal(result.activation.officialCarrier, "anthropic-api-container-skills");
  const activationPayload = result.activation.payload as {
    betas: string[];
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };
  assert.deepEqual(activationPayload.betas, [
    "files-api-2025-04-14",
    "code-execution-2026-01-20",
    "skills-2025-10-02"
  ]);
  assert.equal(activationPayload.container.skills[0]?.skill_id, "sk_use_api_managed");
  assert.equal(activationPayload.tools[0]?.type, "code_execution_20260120");
  assert.equal(result.invocation.adapterId, "skill.anthropic.anthropic-api-managed");
});

test("default rax skill.use can walk source to an Anthropic prebuilt managed skill carrier", async () => {
  const result = await rax.skill.use({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      reference: {
        id: "pptx",
        version: "latest",
        name: "PowerPoint Skill",
        description: "Use the official Anthropic pptx skill."
      },
      mode: "anthropic-api-managed",
      details: {
        type: "anthropic",
        code_execution_type: "code_execution_20250825"
      }
    }
  });

  assert.equal(result.activation.officialCarrier, "anthropic-api-container-skills");
  assert.equal(result.container.source.kind, "virtual");
  assert.equal(result.container.descriptor.id, "pptx");
  assert.equal(result.activation.composeStrategy, "payload-merge");
  assert.match(result.activation.composeNotes ?? "", /Messages API requests/u);
  const activationPayload = result.activation.payload as {
    betas: string[];
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };
  assert.deepEqual(activationPayload.betas, [
    "code-execution-2025-08-25",
    "skills-2025-10-02"
  ]);
  assert.equal(activationPayload.container.skills[0]?.skill_id, "pptx");
  assert.equal(activationPayload.container.skills[0]?.type, "anthropic");
  assert.equal(activationPayload.container.skills[0]?.version, "latest");
  assert.equal(activationPayload.tools[0]?.type, "code_execution_20250825");
  assert.equal(result.invocation.adapterId, "skill.anthropic.anthropic-api-managed");
});

test("default rax skill.mount returns activation plus prepared invocation for an OpenAI inline shell container", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const inlineContainer = rax.skill.bind({
    container,
    provider: "openai",
    mode: "openai-inline-shell",
    details: {
      source: {
        data: "UEsDBAoAAAAAAInlineSkillBundle",
        media_type: "application/zip",
        type: "base64"
      }
    }
  });

  const result = rax.skill.mount({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      container: inlineContainer
    }
  });

  assert.equal(result.activation.officialCarrier, "openai-shell-environment");
  assert.equal(result.invocation.adapterId, "skill.openai.openai-inline-shell");
  const payload = result.invocation.payload as {
    model: string;
    tools: Array<{
      environment: {
        skills: Array<{
          type: string;
          name: string;
          source: { data: string };
        }>;
      };
    }>;
  };
  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.tools[0]?.environment.skills[0]?.type, "inline");
  assert.equal(payload.tools[0]?.environment.skills[0]?.name, container.descriptor.name);
  assert.equal(payload.tools[0]?.environment.skills[0]?.source.data, "UEsDBAoAAAAAAInlineSkillBundle");
});

test("default rax skill.mount returns activation plus prepared invocation for an Anthropic API-managed container", async () => {
  const rootDir = await createLocalSkillFixture();
  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const managedContainer = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "sk_mount_api_managed",
      code_execution_type: "code_execution_20250522",
      betas: ["files-api-2025-04-14"]
    }
  });

  const result = rax.skill.mount({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      container: managedContainer
    }
  });

  assert.equal(result.activation.officialCarrier, "anthropic-api-container-skills");
  assert.equal(result.invocation.adapterId, "skill.anthropic.anthropic-api-managed");
  const payload = result.invocation.payload as {
    model: string;
    max_tokens: number;
    betas: string[];
    container: {
      skills: Array<{ skill_id: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };
  assert.equal(payload.model, "claude-opus-4-6-thinking");
  assert.equal(payload.max_tokens, 1024);
  assert.deepEqual(payload.betas, [
    "files-api-2025-04-14",
    "code-execution-2025-05-22",
    "skills-2025-10-02"
  ]);
  assert.equal(payload.container.skills[0]?.skill_id, "sk_mount_api_managed");
  assert.equal(payload.tools[0]?.type, "code_execution_20250522");
});

test("default rax skill.use and mount keep Anthropic prebuilt skill latest-version references intact", async () => {
  const rootDir = await createLocalSkillFixture();

  const used = await rax.skill.use({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      source: rootDir,
      mode: "anthropic-api-managed",
      details: {
        skill_id: "pptx",
        type: "anthropic",
        version: "latest"
      }
    }
  });

  const usePayload = used.invocation.payload as {
    model: string;
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };
  assert.equal(used.activation.officialCarrier, "anthropic-api-container-skills");
  assert.equal(usePayload.model, "claude-opus-4-6-thinking");
  assert.equal(usePayload.container.skills[0]?.skill_id, "pptx");
  assert.equal(usePayload.container.skills[0]?.type, "anthropic");
  assert.equal(usePayload.container.skills[0]?.version, "latest");
  assert.equal(usePayload.tools[0]?.type, "code_execution_20250825");

  const container = await rax.skill.containerCreate({
    source: rootDir
  });
  const bound = rax.skill.bind({
    container,
    provider: "anthropic",
    mode: "anthropic-api-managed",
    details: {
      skill_id: "pptx",
      type: "anthropic",
      version: "latest"
    }
  });
  const mounted = rax.skill.mount({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      container: bound
    }
  });
  const mountPayload = mounted.invocation.payload as {
    container: {
      skills: Array<{ skill_id: string; type: string; version?: string }>;
    };
    tools: Array<{ type: string; name: string }>;
  };
  assert.equal(mounted.activation.officialCarrier, "anthropic-api-container-skills");
  assert.equal(mountPayload.container.skills[0]?.skill_id, "pptx");
  assert.equal(mountPayload.container.skills[0]?.type, "anthropic");
  assert.equal(mountPayload.container.skills[0]?.version, "latest");
  assert.equal(mountPayload.tools[0]?.type, "code_execution_20250825");
});

test("default rax skill.list prepares an OpenAI managed registry listing", () => {
  const invocation = rax.skill.list({
    provider: "openai",
    model: "gpt-5.4",
    providerOptions: {
      openai: {
        after: "skill_after_001",
        limit: 10
      }
    },
    input: {
      order: "desc"
    }
  });

  assert.equal(invocation.key, "skill.list");
  assert.equal(invocation.adapterId, "skill.openai.managed.list");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.list");
  const payload = invocation.payload as {
    args: Array<{ after?: string; limit?: number; order?: string }>;
  };
  assert.equal(payload.args[0]?.after, "skill_after_001");
  assert.equal(payload.args[0]?.limit, 10);
  assert.equal(payload.args[0]?.order, "desc");
});

test("default rax skill.publish prepares an OpenAI managed skill upload", async () => {
  const rootDir = await createLocalSkillFixture();

  const invocation = await rax.skill.publish({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      source: rootDir
    }
  });

  assert.equal(invocation.key, "skill.create");
  assert.equal(invocation.adapterId, "skill.openai.managed.publish");
  assert.equal(invocation.sdk.entrypoint, "client.skills.create");
  const payload = invocation.payload as {
    operation: string;
    sdkMethodPath: string;
    args: [];
    bundle: {
      source: { kind: string; path: string };
      notes: string[];
    };
  };
  assert.equal(payload.operation, "skills.create");
  assert.equal(payload.sdkMethodPath, "client.skills.create");
  assert.deepEqual(payload.args, []);
  assert.equal(payload.bundle.source.kind, "local-directory");
  assert.equal(payload.bundle.source.path, rootDir);
});

test("default rax skill.publishVersion prepares an OpenAI managed skill version upload", async () => {
  const rootDir = await createLocalSkillFixture();

  const invocation = await rax.skill.publishVersion({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      source: rootDir,
      skillId: "skill_hosted_001",
      setDefault: true
    }
  });

  assert.equal(invocation.adapterId, "skill.openai.managed.versions.publish");
  assert.equal(invocation.sdk.entrypoint, "client.skills.versions.create");
  const payload = invocation.payload as {
    operation: string;
    sdkMethodPath: string;
    args: [string, { default?: boolean }];
    bundle: {
      source: { kind: string; path: string };
    };
  };
  assert.equal(payload.operation, "skills.versions.create");
  assert.equal(payload.sdkMethodPath, "client.skills.versions.create");
  assert.equal(payload.args[0], "skill_hosted_001");
  assert.equal(payload.args[1].default, true);
  assert.equal(payload.bundle.source.kind, "local-directory");
  assert.equal(payload.bundle.source.path, rootDir);
});

test("default rax skill.setDefaultVersion prepares an OpenAI default pointer update", () => {
  const invocation = rax.skill.setDefaultVersion({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001",
      version: "7"
    }
  });

  assert.equal(invocation.key, "skill.update");
  assert.equal(invocation.adapterId, "skill.openai.managed.set-default-version");
  assert.equal(invocation.sdk.entrypoint, "client.skills.update");
  const payload = invocation.payload as {
    args: [string, { default_version: string }];
  };
  assert.equal(payload.args[0], "skill_hosted_001");
  assert.equal(payload.args[1].default_version, "7");
});

test("default rax skill.get prepares an OpenAI managed skill retrieve", () => {
  const invocation = rax.skill.get({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001"
    }
  });

  assert.equal(invocation.key, "skill.read");
  assert.equal(invocation.adapterId, "skill.openai.managed.get");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.retrieve");
  const payload = invocation.payload as {
    args: [string];
  };
  assert.deepEqual(payload.args, ["skill_hosted_001"]);
});

test("default rax skill.getContent prepares an OpenAI managed skill bundle download", () => {
  const invocation = rax.skill.getContent({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001"
    }
  });

  assert.equal(invocation.key, "skill.read");
  assert.equal(invocation.adapterId, "skill.openai.managed.content.get");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.content.retrieve");
  const payload = invocation.payload as {
    args: [string];
  };
  assert.deepEqual(payload.args, ["skill_hosted_001"]);
});

test("default rax skill.remove prepares an OpenAI managed skill delete", () => {
  const invocation = rax.skill.remove({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001"
    }
  });

  assert.equal(invocation.key, "skill.remove");
  assert.equal(invocation.adapterId, "skill.openai.managed.remove");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.delete");
  const payload = invocation.payload as {
    args: [string];
  };
  assert.deepEqual(payload.args, ["skill_hosted_001"]);
});

test("default rax skill.listVersions prepares an OpenAI managed version listing", () => {
  const invocation = rax.skill.listVersions({
    provider: "openai",
    model: "gpt-5.4",
    providerOptions: {
      openai: {
        after: "version_after_001",
        limit: 5
      }
    },
    input: {
      skillId: "skill_hosted_001",
      order: "asc"
    }
  });

  assert.equal(invocation.key, "skill.list");
  assert.equal(invocation.adapterId, "skill.openai.managed.versions.list");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.versions.list");
  const payload = invocation.payload as {
    args: [string, { after?: string; limit?: number; order?: string }];
  };
  assert.equal(payload.args[0], "skill_hosted_001");
  assert.equal(payload.args[1]?.after, "version_after_001");
  assert.equal(payload.args[1]?.limit, 5);
  assert.equal(payload.args[1]?.order, "asc");
});

test("default rax skill.getVersion prepares an OpenAI managed version retrieve", () => {
  const invocation = rax.skill.getVersion({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001",
      version: "version_hosted_007"
    }
  });

  assert.equal(invocation.key, "skill.read");
  assert.equal(invocation.adapterId, "skill.openai.managed.versions.get");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.versions.retrieve");
  const payload = invocation.payload as {
    args: [string, { skill_id: string }];
  };
  assert.equal(payload.args[0], "version_hosted_007");
  assert.equal(payload.args[1].skill_id, "skill_hosted_001");
});

test("default rax skill.getVersionContent prepares an OpenAI managed version bundle download", () => {
  const invocation = rax.skill.getVersionContent({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001",
      version: "version_hosted_007"
    }
  });

  assert.equal(invocation.key, "skill.read");
  assert.equal(invocation.adapterId, "skill.openai.managed.versions.content.get");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.versions.content.retrieve");
  const payload = invocation.payload as {
    args: [string, { skill_id: string }];
  };
  assert.equal(payload.args[0], "version_hosted_007");
  assert.equal(payload.args[1].skill_id, "skill_hosted_001");
});

test("default rax skill.removeVersion prepares an OpenAI managed version delete", () => {
  const invocation = rax.skill.removeVersion({
    provider: "openai",
    model: "gpt-5.4",
    input: {
      skillId: "skill_hosted_001",
      version: "version_hosted_007"
    }
  });

  assert.equal(invocation.key, "skill.remove");
  assert.equal(invocation.adapterId, "skill.openai.managed.versions.remove");
  assert.equal(invocation.sdk.packageName, "openai");
  assert.equal(invocation.sdk.entrypoint, "client.skills.versions.delete");
  const payload = invocation.payload as {
    args: [string, { skill_id: string }];
  };
  assert.equal(payload.args[0], "version_hosted_007");
  assert.equal(payload.args[1].skill_id, "skill_hosted_001");
});

test("default rax skill.list prepares an Anthropic managed registry listing", () => {
  const invocation = rax.skill.list({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    providerOptions: {
      anthropic: {
        page: "cursor_001",
        limit: 20,
        betas: ["files-api-2025-04-14"]
      }
    },
    input: {
      source: "custom"
    }
  });

  assert.equal(invocation.key, "skill.list");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.list");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.list");
  const payload = invocation.payload as {
    args: Array<{
      limit?: number;
      page?: string | null;
      source?: "custom" | "anthropic" | null;
      betas: string[];
    }>;
  };
  assert.equal(payload.args[0]?.page, "cursor_001");
  assert.equal(payload.args[0]?.limit, 20);
  assert.equal(payload.args[0]?.source, "custom");
  assert.deepEqual(payload.args[0]?.betas, ["files-api-2025-04-14", "skills-2025-10-02"]);
});

test("default rax skill.get prepares an Anthropic managed registry fetch", () => {
  const invocation = rax.skill.get({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      skillId: "sk_browser_001"
    }
  });

  assert.equal(invocation.key, "skill.read");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.get");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.retrieve");
  const payload = invocation.payload as {
    args: [string, { betas: string[] }];
  };
  assert.equal(payload.args[0], "sk_browser_001");
  assert.deepEqual(payload.args[1]?.betas, ["skills-2025-10-02"]);
});

test("default rax skill.publish prepares an Anthropic managed skill upload", async () => {
  const rootDir = await createLocalSkillFixture();

  const invocation = await rax.skill.publish({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    providerOptions: {
      anthropic: {
        betas: ["code-execution-2025-08-25"]
      }
    },
    input: {
      source: rootDir,
      displayTitle: "Browser Worker"
    }
  });

  assert.equal(invocation.key, "skill.create");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.publish");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.create");
  const payload = invocation.payload as {
    args: Array<{
      display_title?: string | null;
      betas: string[];
      files: { rootDir: string };
    }>;
  };
  assert.equal(payload.args[0]?.display_title, "Browser Worker");
  assert.deepEqual(payload.args[0]?.betas, [
    "code-execution-2025-08-25",
    "files-api-2025-04-14",
    "skills-2025-10-02"
  ]);
  assert.equal(payload.args[0]?.files.rootDir, rootDir);
});

test("default rax skill.get and version lifecycle preserve custom Anthropic betas while auto-merging skills beta", async () => {
  const rootDir = await createLocalSkillFixture();
  const providerOptions = {
    anthropic: {
      betas: ["files-api-2025-04-14"]
    }
  } as const;

  const getInvocation = rax.skill.get({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    providerOptions,
    input: {
      skillId: "sk_browser_001"
    }
  });
  const getPayload = getInvocation.payload as {
    args: [string, { betas: string[] }];
  };
  assert.deepEqual(getPayload.args[1]?.betas, ["files-api-2025-04-14", "skills-2025-10-02"]);

  const publishVersionInvocation = await rax.skill.publishVersion({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    providerOptions,
    input: {
      source: rootDir,
      skillId: "sk_browser_001"
    }
  });
  const publishVersionPayload = publishVersionInvocation.payload as {
    args: [string, { betas: string[]; files: { rootDir: string } }];
  };
  assert.deepEqual(publishVersionPayload.args[1]?.betas, ["files-api-2025-04-14", "skills-2025-10-02"]);

  const removeVersionInvocation = rax.skill.removeVersion({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    providerOptions,
    input: {
      skillId: "sk_browser_001",
      version: "1759178010641129"
    }
  });
  const removeVersionPayload = removeVersionInvocation.payload as {
    args: [string, { skill_id: string; betas: string[] }];
  };
  assert.deepEqual(removeVersionPayload.args[1]?.betas, ["files-api-2025-04-14", "skills-2025-10-02"]);
});

test("default rax skill.remove prepares an Anthropic managed registry delete", () => {
  const invocation = rax.skill.remove({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      skillId: "sk_browser_001"
    }
  });

  assert.equal(invocation.key, "skill.remove");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.remove");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.delete");
  const payload = invocation.payload as {
    args: [string, { betas: string[] }];
  };
  assert.equal(payload.args[0], "sk_browser_001");
  assert.deepEqual(payload.args[1]?.betas, ["skills-2025-10-02"]);
});

test("default rax skill.listVersions prepares an Anthropic managed version listing", () => {
  const invocation = rax.skill.listVersions({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    providerOptions: {
      anthropic: {
        page: "cursor_002",
        limit: 15
      }
    },
    input: {
      skillId: "sk_browser_001"
    }
  });

  assert.equal(invocation.adapterId, "skill.anthropic.managed.versions.list");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.versions.list");
  const payload = invocation.payload as {
    args: [string, { limit?: number; page?: string | null; betas: string[] }];
  };
  assert.equal(payload.args[0], "sk_browser_001");
  assert.equal(payload.args[1]?.page, "cursor_002");
  assert.equal(payload.args[1]?.limit, 15);
  assert.deepEqual(payload.args[1]?.betas, ["skills-2025-10-02"]);
});

test("default rax skill.getVersion prepares an Anthropic managed version fetch", () => {
  const invocation = rax.skill.getVersion({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      skillId: "sk_browser_001",
      version: "1759178010641129"
    }
  });

  assert.equal(invocation.key, "skill.read");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.versions.get");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.versions.retrieve");
  const payload = invocation.payload as {
    args: [string, { skill_id: string; betas: string[] }];
  };
  assert.equal(payload.args[0], "1759178010641129");
  assert.equal(payload.args[1]?.skill_id, "sk_browser_001");
  assert.deepEqual(payload.args[1]?.betas, ["skills-2025-10-02"]);
});

test("default rax skill.publishVersion prepares an Anthropic managed version upload", async () => {
  const rootDir = await createLocalSkillFixture();

  const invocation = await rax.skill.publishVersion({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      source: rootDir,
      skillId: "sk_browser_001"
    }
  });

  assert.equal(invocation.key, "skill.create");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.versions.publish");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.versions.create");
  const payload = invocation.payload as {
    args: [string, { betas: string[]; files: { rootDir: string } }];
  };
  assert.equal(payload.args[0], "sk_browser_001");
  assert.deepEqual(payload.args[1]?.betas, [
    "files-api-2025-04-14",
    "skills-2025-10-02"
  ]);
  assert.equal(payload.args[1]?.files.rootDir, rootDir);
});

test("default rax skill.removeVersion prepares an Anthropic managed version delete", () => {
  const invocation = rax.skill.removeVersion({
    provider: "anthropic",
    model: "claude-opus-4-6-thinking",
    input: {
      skillId: "sk_browser_001",
      version: "1759178010641129"
    }
  });

  assert.equal(invocation.key, "skill.remove");
  assert.equal(invocation.adapterId, "skill.anthropic.managed.versions.remove");
  assert.equal(invocation.sdk.packageName, "@anthropic-ai/sdk");
  assert.equal(invocation.sdk.entrypoint, "client.beta.skills.versions.delete");
  const payload = invocation.payload as {
    args: [string, { skill_id: string; betas: string[] }];
  };
  assert.equal(payload.args[0], "1759178010641129");
  assert.equal(payload.args[1]?.skill_id, "sk_browser_001");
  assert.deepEqual(payload.args[1]?.betas, ["skills-2025-10-02"]);
});

test("default rax skill.list rejects unsupported Google hosted registry lifecycle", () => {
  assert.throws(
    () =>
      rax.skill.list({
        provider: "deepmind",
        model: "gemini-2.5-flash",
        input: {}
      }),
    (error: unknown) => {
      assert.ok(error instanceof RaxRoutingError);
      assert.equal(error.code, "skill_managed_unsupported");
      return true;
    }
  );
});

test("default rax deepmind hosted skill lifecycle helpers all reject with the same unsupported boundary", async () => {
  const rootDir = await createLocalSkillFixture();

  const unsupportedCalls = [
    {
      label: "get -> skill.read",
      run: () =>
        rax.skill.get({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001"
          }
        })
    },
    {
      label: "publish -> skill.create",
      run: () =>
        rax.skill.publish({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            source: rootDir
          }
        })
    },
    {
      label: "getContent -> skill.read",
      run: () =>
        rax.skill.getContent({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001"
          }
        })
    },
    {
      label: "remove -> skill.remove",
      run: () =>
        rax.skill.remove({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001"
          }
        })
    },
    {
      label: "listVersions -> skill.list",
      run: () =>
        rax.skill.listVersions({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001"
          }
        })
    },
    {
      label: "getVersion -> skill.read",
      run: () =>
        rax.skill.getVersion({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001",
            version: "version_deepmind_001"
          }
        })
    },
    {
      label: "publishVersion -> skill.create",
      run: () =>
        rax.skill.publishVersion({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            source: rootDir,
            skillId: "skill_deepmind_001"
          }
        })
    },
    {
      label: "getVersionContent -> skill.read",
      run: () =>
        rax.skill.getVersionContent({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001",
            version: "version_deepmind_001"
          }
        })
    },
    {
      label: "removeVersion -> skill.remove",
      run: () =>
        rax.skill.removeVersion({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001",
            version: "version_deepmind_001"
          }
        })
    },
    {
      label: "setDefaultVersion -> skill.update",
      run: () =>
        rax.skill.setDefaultVersion({
          provider: "deepmind",
          model: "gemini-2.5-flash",
          input: {
            skillId: "skill_deepmind_001",
            version: "version_deepmind_001"
          }
        })
    }
  ] as const;

  for (const entry of unsupportedCalls) {
    await assert.rejects(
      () => Promise.resolve().then(() => entry.run()),
      (error: unknown) => {
        assert.ok(error instanceof RaxRoutingError, `${entry.label} should reject with RaxRoutingError`);
        assert.equal(error.code, "skill_managed_unsupported");
        return true;
      }
    );
  }
});
