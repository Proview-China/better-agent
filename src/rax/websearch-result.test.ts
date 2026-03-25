import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWebSearchOutput,
  toWebSearchCapabilityResult,
  toWebSearchFailureResult
} from "./websearch-result.js";

test("normalizeWebSearchOutput extracts answer citations and sources from OpenAI-style payload", () => {
  const output = normalizeWebSearchOutput("openai", {
    output_text: "Alpha answer",
    output: [
      {
        type: "web_search_call",
        action: {
          sources: [
            {
              url: "https://example.com/a",
              title: "Example A",
              snippet: "Alpha source"
            }
          ]
        }
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Alpha answer",
            annotations: [
              {
                type: "url_citation",
                url: "https://example.com/a",
                title: "Example A"
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(output.answer, "Alpha answer");
  assert.equal(output.citations.length, 1);
  assert.equal(output.sources.length, 1);
  assert.equal(output.sources[0]?.url, "https://example.com/a");
});

test("normalizeWebSearchOutput extracts answer citations and sources from Anthropic-style payload", () => {
  const output = normalizeWebSearchOutput("anthropic", {
    content: [
      {
        type: "text",
        text: "Beta answer",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://example.com/b",
            title: "Example B"
          }
        ]
      },
      {
        type: "web_search_tool_result",
        results: [
          {
            url: "https://example.com/b",
            title: "Example B",
            snippet: "Beta source"
          }
        ]
      }
    ]
  });

  assert.equal(output.answer, "Beta answer");
  assert.equal(output.citations[0]?.url, "https://example.com/b");
  assert.equal(output.sources[0]?.title, "Example B");
});

test("normalizeWebSearchOutput extracts answer and sources from Anthropic agent-style event stream", () => {
  const output = normalizeWebSearchOutput("anthropic", [
    {
      type: "user",
      tool_use_result: {
        query: "TypeScript official documentation domain",
        results: [
          {
            content: [
              {
                title: "TypeScript",
                url: "https://www.typescriptlang.org/"
              }
            ]
          }
        ]
      }
    },
    {
      type: "result",
      result: "The official TypeScript documentation domain is `typescriptlang.org`."
    }
  ]);

  assert.equal(
    output.answer,
    "The official TypeScript documentation domain is `typescriptlang.org`."
  );
  assert.equal(output.sources[0]?.url, "https://www.typescriptlang.org/");
  assert.equal(output.citations[0]?.title, "TypeScript");
});

test("normalizeWebSearchOutput extracts answer citations and sources from Gemini-style payload", () => {
  const output = normalizeWebSearchOutput("deepmind", {
    candidates: [
      {
        content: {
          parts: [{ text: "Gamma answer" }]
        },
        groundingMetadata: {
          groundingChunks: [
            {
              web: {
                uri: "https://example.com/c",
                title: "Example C"
              }
            }
          ]
        },
        urlContextMetadata: {
          urlMetadata: [
            {
              retrievedUrl: "https://example.com/c",
              title: "Example C"
            }
          ]
        }
      }
    ]
  });

  assert.equal(output.answer, "Gamma answer");
  assert.equal(output.citations[0]?.url, "https://example.com/c");
  assert.equal(output.sources.length, 1);
});

test("normalizeWebSearchOutput keeps Gemini generateContent answer-only payload for later truthfulness checks", () => {
  const output = normalizeWebSearchOutput("deepmind", {
    candidates: [
      {
        content: {
          parts: [{ text: "May 22, 2024: $949.50" }]
        },
        finishReason: "STOP"
      }
    ]
  });

  assert.equal(output.answer, "May 22, 2024: $949.50");
  assert.deepEqual(output.citations, []);
  assert.deepEqual(output.sources, []);
});

test("toWebSearchCapabilityResult wraps normalized output into a capability result", () => {
  const result = toWebSearchCapabilityResult("openai", "gpt-5", "api", {
    output_text: "Grounded answer",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Grounded answer",
            annotations: [
              {
                type: "url_citation",
                url: "https://platform.openai.com/docs",
                title: "OpenAI Docs"
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(result.status, "success");
  assert.equal(result.capability, "search");
  assert.equal(result.action, "ground");
  assert.equal(result.output?.answer, "Grounded answer");
  assert.equal(result.output?.citations[0]?.url, "https://platform.openai.com/docs");
});

test("toWebSearchCapabilityResult marks Anthropic tool_use-only search as partial", () => {
  const result = toWebSearchCapabilityResult("anthropic", "claude-opus-4-6-thinking", "api", {
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "toolu_123",
        name: "web_search",
        input: {
          query: "Anthropic official documentation domain"
        }
      }
    ]
  });

  assert.equal(result.status, "partial");
  assert.deepEqual(result.output, {
    answer: "",
    citations: [],
    sources: [],
    raw: {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_123",
          name: "web_search",
          input: {
            query: "Anthropic official documentation domain"
          }
        }
      ]
    }
  });
  assert.deepEqual(result.error, {
    code: "websearch_incomplete",
    message:
      "Anthropic web search returned tool_use without a finalized answer; this upstream did not complete the search loop in a single response.",
    raw: {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_123",
          name: "web_search",
          input: {
            query: "Anthropic official documentation domain"
          }
        }
      ]
    }
  });
});

test("toWebSearchCapabilityResult keeps Anthropic grounded answers as success once text is finalized", () => {
  const result = toWebSearchCapabilityResult("anthropic", "claude-opus-4-6-thinking", "api", {
    stop_reason: "tool_use",
    content: [
      {
        type: "text",
        text: "The official documentation domain for Anthropic is docs.anthropic.com.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://docs.anthropic.com/en/home",
            title: "Anthropic Docs"
          }
        ]
      }
    ]
  });

  assert.equal(result.status, "success");
  assert.equal(result.error, undefined);
  assert.equal(
    result.output?.answer,
    "The official documentation domain for Anthropic is docs.anthropic.com."
  );
  assert.equal(result.output?.citations[0]?.url, "https://docs.anthropic.com/en/home");
});

test("toWebSearchCapabilityResult marks answer-only grounded output as partial when evidence is missing", () => {
  const result = toWebSearchCapabilityResult("deepmind", "gemini-2.5-pro", "api", {
    candidates: [
      {
        content: {
          parts: [{ text: "The Gemini docs domain is ai.google.dev." }]
        },
        finishReason: "STOP"
      }
    ]
  });

  assert.equal(result.status, "partial");
  assert.deepEqual(result.error, {
    code: "websearch_evidence_missing",
    message:
      "search.ground produced an answer without any citations or source evidence, so the result is not fully grounded yet.",
    raw: {
      candidates: [
        {
          content: {
            parts: [{ text: "The Gemini docs domain is ai.google.dev." }]
          },
          finishReason: "STOP"
        }
      ]
    }
  });
});

test("toWebSearchCapabilityResult marks source-only grounded output as partial when answer text is missing", () => {
  const result = toWebSearchCapabilityResult("openai", "gpt-5", "api", {
    output: [
      {
        type: "web_search_call",
        action: {
          sources: [
            {
              url: "https://platform.openai.com/docs",
              title: "OpenAI Docs",
              snippet: "Responses API web search tool"
            }
          ]
        }
      }
    ]
  });

  assert.equal(result.status, "partial");
  assert.deepEqual(result.error, {
    code: "websearch_answer_missing",
    message:
      "search.ground returned source evidence but no finalized answer text, so the result is only partially complete.",
    raw: {
      output: [
        {
          type: "web_search_call",
          action: {
            sources: [
              {
                url: "https://platform.openai.com/docs",
                title: "OpenAI Docs",
                snippet: "Responses API web search tool"
              }
            ]
          }
        }
      ]
    }
  });
});

test("toWebSearchFailureResult preserves error context", () => {
  const result = toWebSearchFailureResult(
    "anthropic",
    "claude-sonnet-4",
    "api",
    "Search failed",
    { cause: "rate_limit" }
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(result.error, {
    code: "websearch_failed",
    message: "Search failed",
    raw: { cause: "rate_limit" }
  });
});

test("toWebSearchFailureResult keeps explicit error codes when runtime provides them", () => {
  const result = toWebSearchFailureResult(
    "anthropic",
    "claude-sonnet-4",
    "agent",
    "Claude Code search is unavailable on Windows.",
    { platform: "win32" },
    undefined,
    "anthropic_agent_unavailable_on_windows"
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(result.error, {
    code: "anthropic_agent_unavailable_on_windows",
    message: "Claude Code search is unavailable on Windows.",
    raw: { platform: "win32" }
  });
});
