const addonPath = process.argv[2];
const path = require("node:path");

if (!addonPath) {
  throw new Error("addon path is required");
}

const addon = require(addonPath);
const storePath = path.join(path.dirname(addonPath), "node-memory-smoke.json");

const required = [
  "memoryConfigure",
  "memoryIngest",
  "memoryQuery",
  "memoryGet",
  "memoryReset",
  "interruptExecution",
  "sandboxProbe",
];

for (const key of required) {
  if (typeof addon[key] !== "function") {
    throw new Error(`missing ${key}`);
  }
}

const configured = JSON.parse(addon.memoryConfigure(JSON.stringify({
  store_path: storePath,
  max_injection_entries: 2,
  max_injection_chars: 200,
})));
if (configured.status !== "success") {
  throw new Error("memoryConfigure failed");
}

const reset = JSON.parse(addon.memoryReset());
if (reset.status !== "success") {
  throw new Error("memoryReset failed");
}

const ingested = JSON.parse(addon.memoryIngest(JSON.stringify({
  input_type: "conclusion",
  topic: "node-smoke",
  summary: "Node binding should pass through core memory API",
  layer: "task",
  evidence: [{ kind: "note", value: "smoke" }],
})));
if (ingested.status !== "success") {
  throw new Error("memoryIngest failed");
}

const queried = JSON.parse(addon.memoryQuery(JSON.stringify({
  topic: "node-smoke",
})));
if (queried.status !== "success" || queried.returned_matches < 1) {
  throw new Error("memoryQuery failed");
}

const probe = JSON.parse(addon.sandboxProbe());
if (probe.status !== "success" || !probe.capabilities) {
  throw new Error("sandboxProbe failed");
}

console.log("agent_core_node_memory_smoke: PASS");
