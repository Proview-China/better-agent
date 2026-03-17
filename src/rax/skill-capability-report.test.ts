import assert from "node:assert/strict";
import test from "node:test";

import { buildSkillCapabilityReport } from "./skill-capability-report.js";

test("buildSkillCapabilityReport merges official support local profile and live smoke evidence", async () => {
  const report = await buildSkillCapabilityReport({
    generatedAt: "2026-03-15T00:00:00.000Z",
    smokeGeneratedAt: "2026-03-15T00:00:01.000Z",
    smokeRows: [
      {
        provider: "openai",
        step: "managed_registry",
        ok: false,
        model: "gpt-5.4",
        summary: "404 404 page not found"
      },
      {
        provider: "deepmind",
        step: "managed_list",
        ok: true,
        model: "gemini-3-flash",
        summary: "unsupported boundary held as expected"
      },
      {
        provider: "deepmind",
        step: "managed_publish",
        ok: true,
        model: "gemini-3-flash",
        summary: "unsupported boundary held as expected"
      }
    ]
  });

  assert.equal(report.generatedAt, "2026-03-15T00:00:00.000Z");
  assert.equal(report.smokeGeneratedAt, "2026-03-15T00:00:01.000Z");

  const openai = report.providers.find((entry) => entry.provider === "openai");
  assert.ok(openai);
  assert.equal(openai.official.supportsManagedSkills, true);
  assert.equal(openai.localGateway?.supportsManagedSkills, false);
  assert.equal(openai.liveSmoke.status, "route-failed");
  const openaiList = openai.actions.find((entry) => entry.action === "list");
  assert.ok(openaiList);
  assert.equal(openaiList.officialStatus, "documented");
  assert.equal(openaiList.officialNotes, "Maps to client.skills.list and client.skills.versions.list.");
  assert.deepEqual(openaiList.officialDocs, [
    "https://developers.openai.com/api/docs/guides/tools-skills"
  ]);
  assert.equal(openaiList.localGatewayStatus, "blocked");
  assert.deepEqual(openaiList.sdkEntrypoints, ["client.skills.list"]);
  assert.equal(openaiList.preparedPayload.available, true);
  assert.equal(openaiList.preparedPayload.kind, "query");
  assert.equal(openaiList.preparedPayload.argShape, "query-object");
  assert.deepEqual(openaiList.preparedPayload.query, {
    supportsAfter: true,
    supportsLimit: true,
    supportsOrder: true,
    supportsPage: false,
    supportsSource: false
  });
  assert.equal(openaiList.routeEvidence.status, "route-failed");
  assert.deepEqual(openaiList.routeEvidence.steps, ["managed_registry"]);
  assert.equal(openaiList.routeEvidence.failure?.step, "managed_registry");
  assert.equal(openaiList.routeSummary, "404 404 page not found");
  const openaiPublish = openai.actions.find((entry) => entry.action === "publish");
  assert.ok(openaiPublish);
  assert.equal(openaiPublish.preparedPayload.available, true);
  assert.equal(openaiPublish.preparedPayload.kind, "bundle_upload");
  assert.equal(openaiPublish.preparedPayload.upload?.usesBundle, true);
  assert.equal(openaiPublish.preparedPayload.upload?.bundleRootDir, true);
  assert.equal(openaiPublish.preparedPayload.upload?.requiresUploadableLowering, true);
  const openaiContent = openai.actions.find((entry) => entry.action === "getContent");
  assert.ok(openaiContent);
  assert.equal(openaiContent.officialStatus, "documented");
  assert.ok(openaiContent.officialNotes?.includes("OpenAI"));
  assert.deepEqual(openaiContent.sdkEntrypoints, ["client.skills.content.retrieve"]);
  assert.equal(openaiContent.preparedPayload.available, true);
  assert.equal(openaiContent.preparedPayload.kind, "content_download");
  assert.equal(openaiContent.routeEvidence.status, "unknown");
  assert.deepEqual(openaiContent.routeEvidence.rows, []);
  assert.equal(openaiContent.routeSummary, "no action-specific live evidence yet");

  const anthropic = report.providers.find((entry) => entry.provider === "anthropic");
  assert.ok(anthropic);
  const anthropicPublish = anthropic.actions.find((entry) => entry.action === "publish");
  assert.ok(anthropicPublish);
  assert.equal(anthropicPublish.preparedPayload.available, true);
  assert.equal(anthropicPublish.preparedPayload.kind, "bundle_upload");
  assert.equal(anthropicPublish.preparedPayload.upload?.supportsDisplayTitle, true);
  assert.equal(anthropicPublish.preparedPayload.providerSpecific?.betasInjected, true);
  assert.deepEqual(anthropicPublish.preparedPayload.providerSpecific?.betas, [
    "files-api-2025-04-14",
    "skills-2025-10-02"
  ]);

  const deepmind = report.providers.find((entry) => entry.provider === "deepmind");
  assert.ok(deepmind);
  assert.equal(deepmind.official.supportsManagedSkills, false);
  assert.equal(deepmind.liveSmoke.status, "unsupported");
  const deepmindPublish = deepmind.actions.find((entry) => entry.action === "publish");
  assert.ok(deepmindPublish);
  assert.equal(deepmindPublish.officialStatus, "unsupported");
  assert.deepEqual(deepmindPublish.officialDocs, [
    "https://google.github.io/adk-docs/skills/"
  ]);
  assert.equal(deepmindPublish.liveStatus, "unsupported");
  assert.deepEqual(deepmindPublish.sdkEntrypoints, []);
  assert.equal(deepmindPublish.preparedPayload.available, false);
  assert.equal(deepmindPublish.preparedPayload.kind, "unsupported");
  assert.ok(deepmindPublish.preparedPayload.unsupportedReason?.includes("hosted skill publish surface"));
  assert.equal(deepmindPublish.routeEvidence.status, "unsupported");
  assert.deepEqual(deepmindPublish.routeEvidence.steps, ["managed_publish"]);
  assert.equal(deepmindPublish.routeSummary, "unsupported boundary held as expected");
});
