import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityLease } from "../capability-invocation/capability-lease.js";
import { createCapabilityInvocationPlan } from "../capability-invocation/capability-plan.js";
import {
  createTapVendorNetworkAdapter,
  registerTapVendorNetworkCapabilityFamily,
  type TapVendorNetworkAdapterOptions,
} from "./tap-vendor-network-adapter.js";

async function executePlan(
  capabilityKey: "search.web" | "search.fetch" | "search.ground",
  input: Record<string, unknown>,
  options: TapVendorNetworkAdapterOptions = {},
) {
  const adapter = createTapVendorNetworkAdapter({
    capabilityKey,
    ...options,
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: `intent_${capabilityKey}_001`,
      sessionId: `session_${capabilityKey}_001`,
      runId: `run_${capabilityKey}_001`,
      capabilityKey,
      input,
      priority: "normal",
    },
    {
      idFactory: () => `plan_${capabilityKey}_001`,
    },
  );

  const lease = createCapabilityLease(
    {
      capabilityId: `capability_${capabilityKey}_001`,
      bindingId: `binding_${capabilityKey}_001`,
      generation: 1,
      plan,
    },
    {
      idFactory: () => `lease_${capabilityKey}_001`,
      clock: {
        now: () => new Date("2026-04-08T00:00:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  return adapter.execute(prepared);
}

test("tap vendor network adapter executes search.web through the injected websearch facade", async () => {
  const facade = {
    websearch: {
      async create() {
        return {
          status: "success",
          provider: "openai",
          model: "gpt-5.4",
          layer: "api",
          output: {
            answer: "Praxis latest status",
            citations: [{ url: "https://example.com/a" }],
            sources: [{ url: "https://example.com/a", title: "Example" }],
          },
          evidence: [{ source: "test-search" }],
        };
      },
    },
  } as TapVendorNetworkAdapterOptions["facade"];

  const adapter = createTapVendorNetworkAdapter({
    capabilityKey: "search.web",
    facade,
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_search_web_001",
      sessionId: "session_search_web_001",
      runId: "run_search_web_001",
      capabilityKey: "search.web",
      input: {
        provider: "openai",
        model: "gpt-5.4",
        query: "Praxis latest status",
      },
      priority: "high",
    },
    {
      idFactory: () => "plan_search_web_001",
    },
  );

  const lease = createCapabilityLease(
    {
      capabilityId: "capability_search_web_001",
      bindingId: "binding_search_web_001",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease_search_web_001",
      clock: {
        now: () => new Date("2026-04-08T00:00:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  assert.equal(
    (envelope.output as { query?: string }).query,
    "Praxis latest status",
  );
  assert.equal(
    (envelope.output as { sources?: Array<{ url: string }> }).sources?.[0]?.url,
    "https://example.com/a",
  );
  assert.equal(envelope.metadata?.provider, "openai");
  assert.equal(envelope.metadata?.selectedBackend, "openai-codex-style-web-search");
  assert.equal(envelope.metadata?.resolvedBackend, "openai-codex-style-web-search");
});

test("tap vendor network adapter executes search.fetch through the injected fetcher", async () => {
  const envelope = await executePlan(
    "search.fetch",
    {
      url: "https://example.com/page",
      prompt: "extract summary",
    },
    {
    fetcher: async (input) => input.urls.map((url) => ({
      url,
      finalUrl: url,
      title: "Fetched Page",
      contentType: "text/markdown",
      content: `Fetched content for ${url}`,
      contentChars: 42,
      truncated: false,
      transport: "direct",
      status: 200,
    })),
    },
  );

  assert.equal(envelope.status, "success");
  assert.equal((envelope.output as { urlCount?: number }).urlCount, 1);
  assert.equal(
    (envelope.output as { pages?: Array<{ url: string }> }).pages?.[0]?.url,
    "https://example.com/page",
  );
});

test("tap vendor network adapter selects the Claude-style backend for anthropic search.fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("plain text body", {
      status: 200,
      headers: { "content-type": "text/plain" },
    })) as typeof fetch;

  try {
    const envelope = await executePlan("search.fetch", {
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      url: "https://example.com/page",
    });

    assert.equal(envelope.status, "success");
    assert.equal(envelope.metadata?.selectedBackend, "anthropic-claude-code-native");
    assert.equal(envelope.metadata?.resolvedBackend, "anthropic-claude-code-native");
    assert.equal(
      (envelope.output as { pages?: Array<{ backend?: string }> }).pages?.[0]?.backend,
      "anthropic-claude-code-native",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tap vendor network adapter surfaces Claude-style cross-host redirects without auto-following them", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("", {
      status: 302,
      headers: { location: "https://docs.example.net/page" },
    })) as typeof fetch;

  try {
    const envelope = await executePlan("search.fetch", {
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      url: "https://example.com/page",
    });

    assert.equal(envelope.status, "partial");
    assert.equal(
      (envelope.output as { pages?: Array<{ redirectTarget?: string }> }).pages?.[0]?.redirectTarget,
      "https://docs.example.net/page",
    );
    assert.equal(
      (envelope.output as { pages?: Array<{ transport?: string }> }).pages?.[0]?.transport,
      "redirect_notice",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tap vendor network adapter rejects localhost and private targets for search.fetch", async () => {
  const envelope = await executePlan("search.fetch", {
    provider: "deepmind",
    model: "gemini-3.1-pro-preview",
    url: "http://127.0.0.1:8080/private",
  });

  assert.equal(envelope.status, "failed");
  assert.equal(envelope.error?.code, "search_fetch_private_target_denied");
});

test("tap vendor network adapter truncates oversized fetched content", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("A".repeat(60), {
      status: 200,
      headers: { "content-type": "text/plain" },
    })) as typeof fetch;

  try {
    const envelope = await executePlan("search.fetch", {
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      url: "https://example.com/page",
      maxChars: 20,
    });

    const page = (envelope.output as { pages?: Array<{ truncated?: boolean; content?: string }> }).pages?.[0];
    assert.equal(envelope.status, "success");
    assert.equal(page?.truncated, true);
    assert.equal(page?.content?.length, 20);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tap vendor network adapter falls back to portable fetch when a provider-native fetch lane fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "https://example.com/page") {
      return new Response("<html><title>Failure</title></html>", {
        status: 500,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === "https://r.jina.ai/http://example.com/page") {
      return new Response("Portable fallback content", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;

  try {
    const envelope = await executePlan("search.fetch", {
      provider: "anthropic",
      model: "claude-opus-4-6-thinking",
      url: "https://example.com/page",
    });

    assert.equal(envelope.status, "partial");
    assert.equal(envelope.metadata?.selectedBackend, "anthropic-claude-code-native");
    assert.equal(envelope.metadata?.resolvedBackend, "portable-fallback");
    assert.equal(envelope.metadata?.fallbackApplied, true);
    assert.equal(
      (envelope.output as { pages?: Array<{ backend?: string; fallbackApplied?: boolean }> }).pages?.[0]?.backend,
      "portable-fallback",
    );
    assert.equal(
      (envelope.output as { pages?: Array<{ fallbackApplied?: boolean }> }).pages?.[0]?.fallbackApplied,
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tap vendor network adapter falls back to portable search when native grounding returns no usable evidence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("duckduckgo.com/html/?q=")) {
      return new Response(
        "## [Example Result](https://example.com/article)\n",
        { status: 200, headers: { "content-type": "text/markdown" } },
      );
    }
    if (url.includes("r.jina.ai/http://example.com/article")) {
      return new Response("Portable fetched evidence content from Example", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;

  try {
    const facade = {
      websearch: {
        async create() {
          return {
            status: "failed",
            provider: "openai",
            model: "gpt-5.4",
            layer: "api",
            error: {
              code: "websearch_empty",
            },
          };
        },
      },
    } as TapVendorNetworkAdapterOptions["facade"];

    const adapter = createTapVendorNetworkAdapter({
      capabilityKey: "search.ground",
      facade,
    });

    const plan = createCapabilityInvocationPlan(
      {
        intentId: "intent_search_ground_fallback_001",
        sessionId: "session_search_ground_fallback_001",
        runId: "run_search_ground_fallback_001",
        capabilityKey: "search.ground",
        input: {
          provider: "openai",
          model: "gpt-5.4",
          query: "current gold price",
        },
        priority: "normal",
      },
      {
        idFactory: () => "plan_search_ground_fallback_001",
      },
    );

    const lease = createCapabilityLease(
      {
        capabilityId: "capability_search_ground_fallback_001",
        bindingId: "binding_search_ground_fallback_001",
        generation: 1,
        plan,
      },
      {
        idFactory: () => "lease_search_ground_fallback_001",
        clock: {
          now: () => new Date("2026-04-08T00:00:00.000Z"),
        },
      },
    );

    const prepared = await adapter.prepare(plan, lease);
    const envelope = await adapter.execute(prepared);

    assert.equal(envelope.status, "partial");
    assert.equal((envelope.output as { sources?: unknown[] }).sources?.length, 1);
    assert.equal(
      (envelope.output as { citations?: Array<{ url: string }> }).citations?.[0]?.url,
      "https://example.com/article",
    );
    assert.equal(envelope.metadata?.fallbackApplied, true);
    assert.equal(envelope.metadata?.selectedBackend, "openai-codex-style-web-search");
    assert.equal(envelope.metadata?.resolvedBackend, "portable-search-fallback");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tap vendor network adapter applies allowed and blocked domains during portable search fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("duckduckgo.com/html/?q=")) {
      return new Response(
        [
          "## [Blocked Result](https://blocked.example.com/post)",
          "## [Allowed Result](https://allowed.example.com/post)",
          "## [Other Result](https://other.example.com/post)",
        ].join("\n"),
        { status: 200, headers: { "content-type": "text/markdown" } },
      );
    }
    if (url.includes("r.jina.ai/http://allowed.example.com/post")) {
      return new Response("Allowed evidence content", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;

  try {
    const facade = {
      websearch: {
        async create() {
          return {
            status: "failed",
            provider: "openai",
            model: "gpt-5.4",
            layer: "api",
            error: { code: "websearch_empty" },
          };
        },
      },
    } as TapVendorNetworkAdapterOptions["facade"];

    const envelope = await executePlan(
      "search.web",
      {
        provider: "openai",
        model: "gpt-5.4",
        query: "Praxis search",
        allowedDomains: ["allowed.example.com"],
        blockedDomains: ["blocked.example.com"],
      },
      { facade },
    );

    assert.equal(envelope.status, "partial");
    const sources = (envelope.output as { sources?: Array<{ url: string }> }).sources ?? [];
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.url, "https://allowed.example.com/post");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registerTapVendorNetworkCapabilityFamily registers the three network capabilities", () => {
  const capabilityKeys: string[] = [];
  const activationFactoryRefs = new Set<string>();

  const registration = registerTapVendorNetworkCapabilityFamily({
    runtime: {
      registerCapabilityAdapter(manifest, adapter) {
        capabilityKeys.push(manifest.capabilityKey);
        return {
          bindingId: `binding:${manifest.capabilityKey}`,
          adapterId: adapter.id,
        };
      },
      registerTaActivationFactory(ref) {
        activationFactoryRefs.add(ref);
      },
    },
  });

  assert.deepEqual(registration.capabilityKeys, [
    "search.web",
    "search.fetch",
    "search.ground",
  ]);
  assert.equal(registration.packages.length, 3);
  assert.equal(registration.bindings.length, 3);
  assert.equal(registration.activationFactoryRefs.length, activationFactoryRefs.size);
  assert.deepEqual(capabilityKeys, [
    "search.web",
    "search.fetch",
    "search.ground",
  ]);
});
