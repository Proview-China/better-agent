import type { CapabilityResult, ProviderId, SdkLayer } from "./types.js";
import type {
  WebSearchCitation,
  WebSearchOutput,
  WebSearchSource
} from "./websearch-types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pushAnswerPart(target: string[], value: string | undefined): void {
  if (!value) {
    return;
  }
  if (target[target.length - 1] === value) {
    return;
  }
  target.push(value);
}

function pushUniqueSource(target: WebSearchSource[], source: WebSearchSource): void {
  if (target.some((entry) => entry.url === source.url && entry.title === source.title)) {
    return;
  }
  target.push(source);
}

function pushUniqueCitation(target: WebSearchCitation[], citation: WebSearchCitation): void {
  if (
    target.some(
      (entry) =>
        entry.url === citation.url &&
        entry.title === citation.title &&
        entry.providerReference === citation.providerReference
    )
  ) {
    return;
  }
  target.push(citation);
}

function normalizeOpenAIWebSearch(raw: unknown): WebSearchOutput {
  const root = isRecord(raw) ? raw : {};
  const answerParts: string[] = [];
  const citations: WebSearchCitation[] = [];
  const sources: WebSearchSource[] = [];

  const outputText = asString(root.output_text);
  pushAnswerPart(answerParts, outputText);
  const preferOutputText = Boolean(outputText);

  for (const item of asArray(root.output)) {
    if (!isRecord(item)) {
      continue;
    }

    if (item.type === "message") {
      for (const content of asArray(item.content)) {
        if (!isRecord(content)) {
          continue;
        }

        const text = asString(content.text);
        if (!preferOutputText) {
          pushAnswerPart(answerParts, text);
        }

        for (const annotation of asArray(content.annotations)) {
          if (!isRecord(annotation)) {
            continue;
          }
          const url = asString(annotation.url);
          if (!url) {
            continue;
          }

          const citation = {
            url,
            title: asString(annotation.title),
            providerReference: asString(annotation.type),
            raw: annotation
          } satisfies WebSearchCitation;
          pushUniqueCitation(citations, citation);
          pushUniqueSource(sources, {
            url,
            title: citation.title,
            kind: "citation",
            raw: annotation
          });
        }
      }
    }

    if (item.type === "web_search_call") {
      const action = isRecord(item.action) ? item.action : undefined;
      for (const source of asArray(action?.sources)) {
        if (!isRecord(source)) {
          continue;
        }
        const url = asString(source.url);
        if (!url) {
          continue;
        }
        pushUniqueSource(sources, {
          url,
          title: asString(source.title),
          snippet: asString(source.snippet),
          kind: "search_result",
          raw: source
        });
      }
    }
  }

  return {
    answer: answerParts.join("\n").trim(),
    citations,
    sources,
    raw
  };
}

function extractAnthropicCitation(
  citationLike: Record<string, unknown>
): WebSearchCitation | undefined {
  const directUrl = asString(citationLike.url);
  const citedPage = isRecord(citationLike.cited_page) ? citationLike.cited_page : undefined;
  const searchResult = isRecord(citationLike.search_result) ? citationLike.search_result : undefined;
  const url = directUrl ?? asString(citedPage?.url) ?? asString(searchResult?.url);

  if (!url) {
    return undefined;
  }

  return {
    url,
    title:
      asString(citationLike.title) ??
      asString(citedPage?.title) ??
      asString(searchResult?.title),
    snippet:
      asString(citationLike.snippet) ??
      asString(searchResult?.snippet),
    providerReference: asString(citationLike.type),
    raw: citationLike
  };
}

function normalizeAnthropicWebSearch(raw: unknown): WebSearchOutput {
  if (Array.isArray(raw)) {
    const answerParts: string[] = [];
    const citations: WebSearchCitation[] = [];
    const sources: WebSearchSource[] = [];

    for (const event of raw) {
      if (!isRecord(event)) {
        continue;
      }

      if (event.type === "result") {
        pushAnswerPart(answerParts, asString(event.result));
      }

      if (event.type === "user") {
        const toolUseResult = isRecord(event.tool_use_result) ? event.tool_use_result : undefined;
        for (const result of asArray(toolUseResult?.results)) {
          if (!isRecord(result)) {
            continue;
          }
          for (const item of asArray(result.content)) {
            if (!isRecord(item)) {
              continue;
            }
            const url = asString(item.url);
            if (!url) {
              continue;
            }
            pushUniqueSource(sources, {
              url,
              title: asString(item.title),
              kind: "search_result",
              raw: item
            });
            pushUniqueCitation(citations, {
              url,
              title: asString(item.title),
              raw: item
            });
          }
        }
      }
    }

    return {
      answer: answerParts.join("\n").trim(),
      citations,
      sources,
      raw
    };
  }

  const root = isRecord(raw) ? raw : {};
  const answerParts: string[] = [];
  const citations: WebSearchCitation[] = [];
  const sources: WebSearchSource[] = [];

  for (const block of asArray(root.content)) {
    if (!isRecord(block)) {
      continue;
    }

    if (block.type === "text") {
      const text = asString(block.text);
      pushAnswerPart(answerParts, text);

      for (const citationLike of asArray(block.citations)) {
        if (!isRecord(citationLike)) {
          continue;
        }
        const citation = extractAnthropicCitation(citationLike);
        if (!citation) {
          continue;
        }
        pushUniqueCitation(citations, citation);
        pushUniqueSource(sources, {
          url: citation.url,
          title: citation.title,
          snippet: citation.snippet,
          kind: "citation",
          raw: citationLike
        });
      }
    }

    const blockType = asString(block.type);
    if (blockType?.includes("web_search") || blockType?.includes("web_fetch")) {
      for (const result of asArray(block.results)) {
        if (!isRecord(result)) {
          continue;
        }
        const url = asString(result.url);
        if (!url) {
          continue;
        }
        pushUniqueSource(sources, {
          url,
          title: asString(result.title),
          snippet: asString(result.snippet),
          kind: blockType.includes("fetch") ? "fetched_page" : "search_result",
          raw: result
        });
      }
    }
  }

  return {
    answer: answerParts.join("\n").trim(),
    citations,
    sources,
    raw
  };
}

function normalizeDeepMindWebSearch(raw: unknown): WebSearchOutput {
  const root = isRecord(raw) ? raw : {};
  const answerParts: string[] = [];
  const citations: WebSearchCitation[] = [];
  const sources: WebSearchSource[] = [];

  const candidate = asArray(root.candidates).find((entry) => isRecord(entry));
  const content = isRecord(candidate) && isRecord(candidate.content) ? candidate.content : undefined;
  for (const part of asArray(content?.parts)) {
    if (!isRecord(part)) {
      continue;
    }
    const text = asString(part.text);
      pushAnswerPart(answerParts, text);
  }

  const groundingMetadata = isRecord(candidate) && isRecord(candidate.groundingMetadata)
    ? candidate.groundingMetadata
    : undefined;
  for (const chunk of asArray(groundingMetadata?.groundingChunks)) {
    if (!isRecord(chunk)) {
      continue;
    }
    const web = isRecord(chunk.web) ? chunk.web : undefined;
    const url = asString(web?.uri);
    if (!url) {
      continue;
    }
    const citation = {
      url,
      title: asString(web?.title),
      providerReference: "grounding_chunk",
      raw: chunk
    } satisfies WebSearchCitation;
    pushUniqueCitation(citations, citation);
    pushUniqueSource(sources, {
      url,
      title: citation.title,
      kind: "search_result",
      raw: chunk
    });
  }

  const urlContextMetadata = isRecord(candidate) && isRecord(candidate.urlContextMetadata)
    ? candidate.urlContextMetadata
    : undefined;
  for (const item of asArray(urlContextMetadata?.urlMetadata)) {
    if (!isRecord(item)) {
      continue;
    }
    const url = asString(item.retrievedUrl) ?? asString(item.url);
    if (!url) {
      continue;
    }
    pushUniqueSource(sources, {
      url,
      title: asString(item.title),
      snippet: asString(item.text),
      kind: "fetched_page",
      raw: item
    });
  }

  return {
    answer: answerParts.join("\n").trim(),
    citations,
    sources,
    raw
  };
}

function inferWebSearchStatus(
  provider: ProviderId,
  raw: unknown,
  output: WebSearchOutput
): {
  status: CapabilityResult<WebSearchOutput>["status"];
  error?: CapabilityResult<WebSearchOutput>["error"];
} {
  const hasEvidence = output.citations.length > 0 || output.sources.length > 0;
  const hasAnswer = output.answer.length > 0;

  if (provider === "anthropic" && isRecord(raw)) {
    const stopReason = asString(raw.stop_reason);
    if (stopReason === "tool_use" && output.answer.length === 0) {
      return {
        status: "partial",
        error: {
          code: "websearch_incomplete",
          message:
            "Anthropic web search returned tool_use without a finalized answer; this upstream did not complete the search loop in a single response.",
          raw
        }
      };
    }
  }

  if (hasAnswer && !hasEvidence) {
    return {
      status: "partial",
      error: {
        code: "websearch_evidence_missing",
        message:
          "search.ground produced an answer without any citations or source evidence, so the result is not fully grounded yet.",
        raw
      }
    };
  }

  if (!hasAnswer && hasEvidence) {
    return {
      status: "partial",
      error: {
        code: "websearch_answer_missing",
        message:
          "search.ground returned source evidence but no finalized answer text, so the result is only partially complete.",
        raw
      }
    };
  }

  if (!hasAnswer && !hasEvidence) {
    return {
      status: "failed",
      error: {
        code: "websearch_empty",
        message:
          "search.ground returned neither answer text nor source evidence, so the search call did not produce a usable grounded result.",
        raw
      }
    };
  }

  return { status: "success" };
}

export function normalizeWebSearchOutput(
  provider: ProviderId,
  raw: unknown
): WebSearchOutput {
  switch (provider) {
    case "openai":
      return normalizeOpenAIWebSearch(raw);
    case "anthropic":
      return normalizeAnthropicWebSearch(raw);
    case "deepmind":
      return normalizeDeepMindWebSearch(raw);
  }
}

export function toWebSearchCapabilityResult(
  provider: ProviderId,
  model: string,
  layer: Exclude<SdkLayer, "auto">,
  raw: unknown,
  profileId?: string
): CapabilityResult<WebSearchOutput> {
  const output = normalizeWebSearchOutput(provider, raw);
  const inferred = inferWebSearchStatus(provider, raw, output);
  return {
    status: inferred.status,
    provider,
    model,
    layer,
    compatibilityProfileId: profileId,
    capability: "search",
    action: "ground",
    output,
    evidence: output.sources,
    error: inferred.error
  };
}

export function toWebSearchFailureResult(
  provider: ProviderId,
  model: string,
  layer: Exclude<SdkLayer, "auto">,
  message: string,
  raw?: unknown,
  profileId?: string,
  code = "websearch_failed"
): CapabilityResult<WebSearchOutput> {
  return {
    status: "failed",
    provider,
    model,
    layer,
    compatibilityProfileId: profileId,
    capability: "search",
    action: "ground",
    error: {
      code,
      message,
      raw
    }
  };
}
