import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCapabilityLease } from "../capability-invocation/capability-lease.js";
import { createCapabilityInvocationPlan } from "../capability-invocation/capability-plan.js";
import {
  createTapVendorUserIoAdapter,
  registerTapVendorUserIoFamily,
} from "./tap-vendor-user-io-adapter.js";

test("tap vendor user-io adapter blocks with structured questions for request_user_input", async () => {
  const adapter = createTapVendorUserIoAdapter({
    capabilityKey: "request_user_input",
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_user_input_001",
      sessionId: "session_user_input_001",
      runId: "run_user_input_001",
      capabilityKey: "request_user_input",
      input: {
        questions: [
          {
            id: "scope",
            header: "范围",
            question: "这次是只改后端还是前后端一起改？",
            options: [],
          },
        ],
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_user_input_001",
    },
  );

  const lease = createCapabilityLease(
    {
      capabilityId: "capability_user_input_001",
      bindingId: "binding_user_input_001",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease_user_input_001",
      clock: {
        now: () => new Date("2026-04-08T00:00:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "blocked");
  assert.equal(envelope.metadata?.waitingHuman, true);
  assert.equal(envelope.error?.code, "tap_vendor_user_input_required");
});

test("tap vendor user-io adapter transcribes audio into structured text", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-userio-"));
  const audioPath = path.join(workspaceRoot, "sample.mp3");
  await writeFile(audioPath, "fake-audio");
  const adapter = createTapVendorUserIoAdapter({
    capabilityKey: "audio.transcribe",
    workspaceRoot,
    openaiClientFactory: () => ({
      audio: {
        transcriptions: {
          create: async () => ({
            text: "当前 XAU/USD 实时价格为 4755.44 美元每盎司。",
            usage: { type: "duration", seconds: 5.1 },
          }),
        },
      },
    } as never),
  });

  const plan = createCapabilityInvocationPlan(
    {
      intentId: "intent_audio_transcribe_001",
      sessionId: "session_audio_transcribe_001",
      runId: "run_audio_transcribe_001",
      capabilityKey: "audio.transcribe",
      input: {
        path: "sample.mp3",
        language: "zh",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_audio_transcribe_001",
    },
  );
  const lease = createCapabilityLease(
    {
      capabilityId: "capability_audio_transcribe_001",
      bindingId: "binding_audio_transcribe_001",
      generation: 1,
      plan,
    },
    {
      idFactory: () => "lease_audio_transcribe_001",
      clock: {
        now: () => new Date("2026-04-10T00:00:00.000Z"),
      },
    },
  );

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);
  assert.equal(envelope.status, "success");
  assert.equal(
    (envelope.output as { text?: string } | undefined)?.text,
    "当前 XAU/USD 实时价格为 4755.44 美元每盎司。",
  );
});

test("tap vendor user-io adapter writes synthesized speech and generated images to local artifacts", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "praxis-userio-"));
  const adapter = createTapVendorUserIoAdapter({
    capabilityKey: "speech.synthesize",
    workspaceRoot,
    openaiClientFactory: () => ({
      audio: {
        speech: {
          create: async () => new Response(Uint8Array.from([1, 2, 3, 4])),
        },
      },
      images: {
        generate: async () => ({
          data: [
            {
              b64_json: Buffer.from("PNGDATA").toString("base64"),
              revised_prompt: "revised",
            },
          ],
          size: "1024x1024",
          quality: "high",
        }),
      },
    } as never),
  });

  const speechPlan = createCapabilityInvocationPlan(
    {
      intentId: "intent_speech_synthesize_001",
      sessionId: "session_speech_synthesize_001",
      runId: "run_speech_synthesize_001",
      capabilityKey: "speech.synthesize",
      input: {
        input: "Hello Praxis",
        path: "memory/generated/hello.mp3",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_speech_synthesize_001",
    },
  );
  const speechLease = createCapabilityLease(
    {
      capabilityId: "capability_speech_synthesize_001",
      bindingId: "binding_speech_synthesize_001",
      generation: 1,
      plan: speechPlan,
    },
    {
      idFactory: () => "lease_speech_synthesize_001",
      clock: {
        now: () => new Date("2026-04-10T00:00:00.000Z"),
      },
    },
  );
  const speechPrepared = await adapter.prepare(speechPlan, speechLease);
  const speechEnvelope = await adapter.execute(speechPrepared);
  const speechBytes = await readFile(path.join(workspaceRoot, "memory/generated/hello.mp3"));
  assert.equal(speechEnvelope.status, "success");
  assert.equal(speechBytes.byteLength, 4);

  const imageAdapter = createTapVendorUserIoAdapter({
    capabilityKey: "image.generate",
    workspaceRoot,
    openaiClientFactory: () => ({
      images: {
        generate: async () => ({
          data: [
            {
              b64_json: Buffer.from("PNGDATA").toString("base64"),
              revised_prompt: "revised",
            },
          ],
          size: "1024x1024",
          quality: "high",
        }),
      },
    } as never),
  });
  const imagePlan = createCapabilityInvocationPlan(
    {
      intentId: "intent_image_generate_001",
      sessionId: "session_image_generate_001",
      runId: "run_image_generate_001",
      capabilityKey: "image.generate",
      input: {
        prompt: "A precise technical illustration",
        path: "memory/generated/image.png",
      },
      priority: "normal",
    },
    {
      idFactory: () => "plan_image_generate_001",
    },
  );
  const imageLease = createCapabilityLease(
    {
      capabilityId: "capability_image_generate_001",
      bindingId: "binding_image_generate_001",
      generation: 1,
      plan: imagePlan,
    },
    {
      idFactory: () => "lease_image_generate_001",
      clock: {
        now: () => new Date("2026-04-10T00:00:00.000Z"),
      },
    },
  );
  const imagePrepared = await imageAdapter.prepare(imagePlan, imageLease);
  const imageEnvelope = await imageAdapter.execute(imagePrepared);
  const imageBytes = await readFile(path.join(workspaceRoot, "memory/generated/image.png"));
  assert.equal(imageEnvelope.status, "success");
  assert.equal((imageEnvelope.output as { revisedPrompt?: string } | undefined)?.revisedPrompt, "revised");
  assert.equal(imageBytes.toString("utf8"), "PNGDATA");
});

test("registerTapVendorUserIoFamily registers the multimodal user-io baseline capabilities", () => {
  const capabilityKeys: string[] = [];
  const activationFactoryRefs = new Set<string>();

  const registration = registerTapVendorUserIoFamily({
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
    "request_user_input",
    "request_permissions",
    "audio.transcribe",
    "speech.synthesize",
    "image.generate",
  ]);
  assert.equal(registration.packages.length, 5);
  assert.equal(registration.bindings.length, 5);
  assert.equal(registration.activationFactoryRefs.length, activationFactoryRefs.size);
  assert.deepEqual(capabilityKeys, [
    "request_user_input",
    "request_permissions",
    "audio.transcribe",
    "speech.synthesize",
    "image.generate",
  ]);
});
