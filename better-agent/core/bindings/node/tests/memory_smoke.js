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
  "sandboxProbe",
  "buildGptResponsesRequest",
  "buildGptToolset",
  "buildGptBasicAbilities",
  "buildAfterToolUseHookPayload",
  "renderSkillsSection",
  "rustRuntimeVersion",
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
for (const key of ["linux_cgroup_mode", "linux_seccomp_mode", "linux_seccomp_profile"]) {
  if (!probe.supported_policy || !(key in probe.supported_policy)) {
    throw new Error(`sandboxProbe missing ${key}`);
  }
}

const rustVersion = JSON.parse(addon.rustRuntimeVersion());
if (rustVersion.status !== "success" || rustVersion.runtime !== "rust") {
  throw new Error("rustRuntimeVersion failed");
}

const built = JSON.parse(addon.buildGptResponsesRequest(JSON.stringify({
  model: "gpt-5.4",
  input_text: "Reply with exactly OK",
  shell_tool: "local_shell",
  web_search: { external_web_access: true },
  text: { verbosity: "low" },
})));
if (built.model !== "gpt-5.4" || !Array.isArray(built.tools) || built.tools.length < 2) {
  throw new Error("buildGptResponsesRequest failed");
}

const toolset = JSON.parse(addon.buildGptToolset(JSON.stringify({
  model: "gpt-5.4",
  shell_tool: "local_shell",
  web_search: { external_web_access: true },
  js_repl_enabled: true,
  artifacts_enabled: true,
  view_image_enabled: true,
  mcp_resource_tools_enabled: true,
  hooks_enabled: true,
  skills_enabled: true,
  skill_roots: ["/tmp/skills"],
})));
if (toolset.status !== "success" || !Array.isArray(toolset.tools) || toolset.tool_count < 7) {
  throw new Error("buildGptToolset failed");
}
if (!toolset.runtime_capabilities?.hooks?.enabled || !toolset.runtime_capabilities?.skills?.enabled) {
  throw new Error("runtime capabilities missing");
}

const basic = JSON.parse(addon.buildGptBasicAbilities(JSON.stringify({
  model: "gpt-5.4",
})));
if (basic.status !== "success" || basic.preset !== "gpt_basic_abilities" || basic.tool_count < 8) {
  throw new Error("buildGptBasicAbilities failed");
}

const hook = JSON.parse(addon.buildAfterToolUseHookPayload(JSON.stringify({
  turn_id: "turn-1",
  call_id: "call-1",
  tool_name: "shell_command",
  tool_kind: "local_shell",
  tool_input: {
    input_type: "local_shell",
    params: {
      command: ["bash", "-lc", "printf hi"],
      workdir: "/tmp",
      timeout_ms: 1000,
    },
  },
  executed: true,
  success: true,
  duration_ms: 10,
  mutating: false,
  sandbox: "workspace-write",
  sandbox_policy: "workspace-write",
  output_preview: "hi",
})));
if (hook.event_type !== "after_tool_use") {
  throw new Error("buildAfterToolUseHookPayload failed");
}

const skills = JSON.parse(addon.renderSkillsSection(JSON.stringify([
  { name: "playwright", description: "browser automation", path: "/tmp/playwright/SKILL.md" },
])));
if (skills.status !== "success" || !skills.rendered.includes("playwright")) {
  throw new Error("renderSkillsSection failed");
}

console.log("agent_core_node_memory_smoke: PASS");
