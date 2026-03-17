import type {
  CapabilityDefinition,
  CapabilityKey,
  ProviderId,
  SupportStatus
} from "./types.js";

function defineCapability(definition: CapabilityDefinition): CapabilityDefinition {
  return definition;
}

export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = [
  defineCapability({
    key: "generate.create",
    namespace: "generate",
    action: "create",
    plane: "inference",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Create a non-realtime generation result.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "generate.stream",
    namespace: "generate",
    action: "stream",
    plane: "inference",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Create a streamed generation result.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "generate.live",
    namespace: "generate",
    action: "live",
    plane: "inference",
    pool: "shared",
    weight: "thick",
    defaultLayer: "api",
    description: "Run a low-latency realtime/live generation session.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Realtime API and realtime agents." },
      anthropic: { status: "unsupported", notes: "No first-class live API documented in the current baseline." },
      deepmind: { status: "documented", preferredLayer: "api", notes: "Gemini Live API." }
    }
  }),
  defineCapability({
    key: "generate.structure",
    namespace: "generate",
    action: "structure",
    plane: "inference",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Produce schema-constrained or otherwise structured output.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "embed.create",
    namespace: "embed",
    action: "create",
    plane: "inference",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Create embeddings/vector representations.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "unsupported", notes: "Anthropic currently points users to third-party embedding providers." },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "skill.define",
    namespace: "skill",
    action: "define",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Define a provider-agnostic skill carrier from a local or managed skill package.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Maps to OpenAI skill bundles and shell skill carriers." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Maps to Anthropic skill packages across SDK and API managed skills." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Maps to ADK Skills as local or code-defined carriers." }
    }
  }),
  defineCapability({
    key: "skill.discover",
    namespace: "skill",
    action: "discover",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Discover available skills through metadata without fully expanding the skill package.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "OpenAI skill carriers expose metadata before full bundle expansion." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Anthropic skills are discovered through metadata before full instructions load." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "ADK Skills expose L1 metadata for discovery." }
    }
  }),
  defineCapability({
    key: "skill.bind",
    namespace: "skill",
    action: "bind",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Bind a skill carrier to the official runtime surface of a specific provider.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Binds to shell environment skills, including local shell skills, hosted shell skill_reference attachments, and inline skill bundles." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Binds to API container.skills or SDK filesystem Skill carriers." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Binds to ADK SkillToolset." }
    }
  }),
  defineCapability({
    key: "skill.activate",
    namespace: "skill",
    action: "activate",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Activate a bound skill carrier and translate it into provider-specific official execution payloads.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Activates shell skill carriers by expanding official shell environment payloads, including hosted skill_reference attachments, inline skill bundles, and hosted shell settings." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Activates API or SDK skill carriers by expanding official Anthropic request/options payloads." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Activates ADK skill carriers through SkillToolset payload generation." }
    }
  }),
  defineCapability({
    key: "skill.use",
    namespace: "skill",
    action: "use",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Use a skill source through the unified Praxis public language and translate it into the official carrier for the selected provider.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Uses local or hosted shell skills through the unified skill path." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Uses Anthropic skill carriers through SDK filesystem or API managed routes." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Uses ADK Skills through SkillToolset preparation." }
    }
  }),
  defineCapability({
    key: "skill.load",
    namespace: "skill",
    action: "load",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Load a local skill package from a directory or bundle into the unified skill carrier format.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "OpenAI supports local shell skill directories." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Anthropic SDK skills are filesystem-first." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "ADK Skills support local directory loading." }
    }
  }),
  defineCapability({
    key: "skill.list",
    namespace: "skill",
    action: "list",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "api",
    description: "List managed or hosted skills from the provider registry where that lifecycle is officially documented.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Maps to client.skills.list and client.skills.versions.list." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Maps to client.beta.skills.list and client.beta.skills.versions.list." },
      deepmind: { status: "unsupported", notes: "Google ADK does not currently document a hosted skill registry list surface." }
    }
  }),
  defineCapability({
    key: "skill.read",
    namespace: "skill",
    action: "read",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "api",
    description: "Read managed or hosted skill metadata from the provider registry where that lifecycle is officially documented.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Maps to client.skills.retrieve and client.skills.versions.retrieve." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Maps to client.beta.skills.retrieve and client.beta.skills.versions.retrieve." },
      deepmind: { status: "unsupported", notes: "Google ADK does not currently document a hosted skill registry get surface." }
    }
  }),
  defineCapability({
    key: "skill.create",
    namespace: "skill",
    action: "create",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "api",
    description: "Publish a managed or hosted skill bundle where the provider exposes a documented skill registry lifecycle.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Maps to client.skills.create and client.skills.versions.create." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Maps to client.beta.skills.create and client.beta.skills.versions.create; upload surfaces auto-merge official skills and files-api betas." },
      deepmind: { status: "unsupported", notes: "Google ADK does not currently document a hosted skill publish surface." }
    }
  }),
  defineCapability({
    key: "skill.update",
    namespace: "skill",
    action: "update",
    plane: "runtime",
    pool: "provider",
    weight: "thick",
    defaultLayer: "api",
    description: "Update managed skill registry state where the provider exposes a documented mutable lifecycle, such as a default-version pointer.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Maps to client.skills.update for default_version pointer changes." },
      anthropic: { status: "unsupported", notes: "Anthropic beta.skills does not currently document a default-version update surface." },
      deepmind: { status: "unsupported", notes: "Google ADK does not currently document a hosted skill update surface." }
    }
  }),
  defineCapability({
    key: "skill.remove",
    namespace: "skill",
    action: "remove",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "api",
    description: "Delete a managed or hosted skill bundle or skill version where the provider exposes a documented registry lifecycle.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Maps to client.skills.delete and client.skills.versions.delete." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Maps to client.beta.skills.delete and client.beta.skills.versions.delete." },
      deepmind: { status: "unsupported", notes: "Google ADK does not currently document a hosted skill delete surface." }
    }
  }),
  defineCapability({
    key: "tool.define",
    namespace: "tool",
    action: "define",
    plane: "tool",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Register a tool/function contract for model use.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "api", notes: "App-side tool definitions feed Responses/Agents tooling." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "App-side tool definitions feed Messages/tool use." },
      deepmind: { status: "inferred", preferredLayer: "api", notes: "App-side tool definitions feed function calling/tool use." }
    }
  }),
  defineCapability({
    key: "tool.list",
    namespace: "tool",
    action: "list",
    plane: "tool",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "List currently exposed tool contracts.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "api" },
      anthropic: { status: "inferred", preferredLayer: "api" },
      deepmind: { status: "inferred", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "tool.call",
    namespace: "tool",
    action: "call",
    plane: "tool",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Execute a provider-mediated or app-defined tool call.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "tool.result",
    namespace: "tool",
    action: "result",
    plane: "tool",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Return tool execution output back into the model/runtime loop.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "api" },
      anthropic: { status: "inferred", preferredLayer: "api" },
      deepmind: { status: "inferred", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "mcp.connect",
    namespace: "mcp",
    action: "connect",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Connect to an MCP server for remote tool discovery and invocation.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "OpenAI documents MCP carriers on both API and agent sides; current rax lowering still uses a shared MCP client runtime." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Anthropic documents MCP on both API connector and agent/runtime paths; current rax lowering still uses a shared MCP client runtime." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Gemini and ADK document MCP carriers, while current rax lowering still uses a shared MCP client runtime." }
    }
  }),
  defineCapability({
    key: "mcp.listConnections",
    namespace: "mcp",
    action: "listConnections",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "List active MCP connections inside the current route scope.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." }
    }
  }),
  defineCapability({
    key: "mcp.listTools",
    namespace: "mcp",
    action: "listTools",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Discover the tools exposed by a connected MCP server.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Tool discovery is a documented MCP concept, but this action is currently exposed through the shared rax MCP runtime rather than a provider-native helper." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Tool discovery is a documented MCP concept, but this action is currently exposed through the shared rax MCP runtime rather than a provider-native helper." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Tool discovery is a documented MCP concept, but this action is currently exposed through the shared rax MCP runtime rather than a provider-native helper." }
    }
  }),
  defineCapability({
    key: "mcp.listResources",
    namespace: "mcp",
    action: "listResources",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "List resources exposed by a connected MCP server.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP resources, not a first-class OpenAI SDK action." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a shared rax MCP client surface over MCP resources; Anthropic API connector semantics are narrower than the generic runtime surface." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP resources, not a first-class Gemini or ADK SDK action." }
    }
  }),
  defineCapability({
    key: "mcp.readResource",
    namespace: "mcp",
    action: "readResource",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Read the contents of a resource exposed by a connected MCP server.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP resources, not a first-class OpenAI SDK action." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a shared rax MCP client surface over MCP resources; Anthropic API connector semantics are narrower than the generic runtime surface." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP resources, not a first-class Gemini or ADK SDK action." }
    }
  }),
  defineCapability({
    key: "mcp.listPrompts",
    namespace: "mcp",
    action: "listPrompts",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "List prompt templates exposed by a connected MCP server.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP prompts, not a first-class OpenAI SDK action." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a shared rax MCP client surface over MCP prompts; Anthropic API connector semantics are narrower than the generic runtime surface." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP prompts, not a first-class Gemini or ADK SDK action." }
    }
  }),
  defineCapability({
    key: "mcp.getPrompt",
    namespace: "mcp",
    action: "getPrompt",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Resolve a prompt template exposed by a connected MCP server into concrete messages.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP prompts, not a first-class OpenAI SDK action." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a shared rax MCP client surface over MCP prompts; Anthropic API connector semantics are narrower than the generic runtime surface." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a shared rax MCP client surface over MCP prompts, not a first-class Gemini or ADK SDK action." }
    }
  }),
  defineCapability({
    key: "mcp.call",
    namespace: "mcp",
    action: "call",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Call a tool exposed through an MCP server.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Tool execution through MCP is documented, while the current lowering still runs through the shared rax MCP client runtime." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Tool execution through MCP is documented, while the current lowering still runs through the shared rax MCP client runtime." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Tool execution through MCP is documented, while the current lowering still runs through the shared rax MCP client runtime." }
    }
  }),
  defineCapability({
    key: "mcp.disconnect",
    namespace: "mcp",
    action: "disconnect",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Close a specific MCP connection inside the current route scope.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." }
    }
  }),
  defineCapability({
    key: "mcp.disconnectAll",
    namespace: "mcp",
    action: "disconnectAll",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Close all active MCP connections inside the current route scope.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." },
      anthropic: { status: "inferred", preferredLayer: "api", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "This is a rax runtime lifecycle surface layered over MCP client connections." }
    }
  }),
  defineCapability({
    key: "mcp.serve",
    namespace: "mcp",
    action: "serve",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Expose an MCP server from the local runtime/app side.",
    providerSupport: {
      openai: { status: "unsupported", notes: "No first-class MCP server hosting surface is documented in the current baseline." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Claude Agent SDK exposes createSdkMcpServer() for in-process MCP server config on the agent/runtime side." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "ADK docs mention both MCP consumption and exposure, but current rax JS baseline has not yet exposed a first-class ADK server builder." }
    }
  }),
  defineCapability({
    key: "search.web",
    namespace: "search",
    action: "web",
    plane: "tool",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Search the web using provider-supported search capabilities.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "search.fetch",
    namespace: "search",
    action: "fetch",
    plane: "tool",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Fetch targeted URL/page content through provider-supported retrieval tools.",
    providerSupport: {
      openai: { status: "unsupported", notes: "OpenAI native search on the Responses path does not expose a separate first-class fetch tool." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Web fetch is explicitly documented." },
      deepmind: { status: "documented", preferredLayer: "api", notes: "URL Context is the nearest documented analog." }
    }
  }),
  defineCapability({
    key: "search.ground",
    namespace: "search",
    action: "ground",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "api",
    description: "Ground a response in external sources or provider-specific search/context systems.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Responses web_search can return source-linked search outputs and web search call sources." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Claude Code / agent runtime is the most reliable native grounding path on current Anthropic routes; API server tools remain available as a lower-level variant." },
      deepmind: { status: "documented", preferredLayer: "api", notes: "Google Search grounding is explicit; URL Context composes when specific pages are supplied." }
    }
  }),
  defineCapability({
    key: "code.run",
    namespace: "code",
    action: "run",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Execute code or code-like tasks in a provider-supported execution environment.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Code interpreter/tools are documented platform capabilities." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Code execution and bash tools are documented." },
      deepmind: { status: "documented", preferredLayer: "api", notes: "Code execution is documented among Gemini tools." }
    }
  }),
  defineCapability({
    key: "code.patch",
    namespace: "code",
    action: "patch",
    plane: "tool",
    pool: "provider",
    weight: "thick",
    defaultLayer: "auto",
    description: "Apply patch-like source modifications through provider-native tooling.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Apply patch appears in OpenAI tool support matrices." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Text editor tool can express patch-like editing." },
      deepmind: { status: "unconfirmed", notes: "No direct patch/edit primitive is clearly documented in the current baseline." }
    }
  }),
  defineCapability({
    key: "code.sandbox",
    namespace: "code",
    action: "sandbox",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Request or describe execution inside a constrained sandbox.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "api" },
      anthropic: { status: "inferred", preferredLayer: "agent" },
      deepmind: { status: "inferred", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "computer.use",
    namespace: "computer",
    action: "use",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Run a computer-use/GUI control loop.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "computer.observe",
    namespace: "computer",
    action: "observe",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Capture observation state inside a computer-use loop.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "api" },
      anthropic: { status: "inferred", preferredLayer: "api" },
      deepmind: { status: "inferred", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "computer.act",
    namespace: "computer",
    action: "act",
    plane: "tool",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Execute a single action inside a computer-use loop.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "api" },
      anthropic: { status: "inferred", preferredLayer: "api" },
      deepmind: { status: "inferred", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "shell.run",
    namespace: "shell",
    action: "run",
    plane: "tool",
    pool: "provider",
    weight: "thick",
    defaultLayer: "auto",
    description: "Run a shell command through provider-native tooling.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api", notes: "Local shell appears in supported OpenAI tool matrices." },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Bash tool is documented." },
      deepmind: { status: "unconfirmed", notes: "No direct shell primitive is clearly documented in the current baseline." }
    }
  }),
  defineCapability({
    key: "shell.approve",
    namespace: "shell",
    action: "approve",
    plane: "tool",
    pool: "provider",
    weight: "thick",
    defaultLayer: "agent",
    description: "Approve a shell-like action before execution.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent" },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Claude SDK explicitly supports tool permission callbacks." },
      deepmind: { status: "unconfirmed" }
    }
  }),
  defineCapability({
    key: "session.open",
    namespace: "session",
    action: "open",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Open a new runtime/session context.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "documented", preferredLayer: "agent" },
      deepmind: { status: "documented", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "session.resume",
    namespace: "session",
    action: "resume",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Resume a previously persisted runtime/session context.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "documented", preferredLayer: "agent" },
      deepmind: { status: "documented", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "session.fork",
    namespace: "session",
    action: "fork",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Fork a session into a derivative working branch.",
    providerSupport: {
      openai: { status: "unconfirmed" },
      anthropic: { status: "documented", preferredLayer: "agent" },
      deepmind: { status: "inferred", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "session.compact",
    namespace: "session",
    action: "compact",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "auto",
    description: "Compact or otherwise shrink session context/state.",
    providerSupport: {
      openai: { status: "unconfirmed" },
      anthropic: { status: "documented", preferredLayer: "api", notes: "Context compaction/editing is documented at the API layer." },
      deepmind: { status: "unconfirmed" }
    }
  }),
  defineCapability({
    key: "session.close",
    namespace: "session",
    action: "close",
    plane: "runtime",
    pool: "shared",
    weight: "thin",
    defaultLayer: "agent",
    description: "Close or conclude a session lifecycle.",
    providerSupport: {
      openai: { status: "inferred", preferredLayer: "agent" },
      anthropic: { status: "inferred", preferredLayer: "agent" },
      deepmind: { status: "inferred", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "agent.run",
    namespace: "agent",
    action: "run",
    plane: "runtime",
    pool: "core",
    weight: "thick",
    defaultLayer: "agent",
    description: "Run an agent or agentic workflow.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "documented", preferredLayer: "agent" },
      deepmind: { status: "documented", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "agent.delegate",
    namespace: "agent",
    action: "delegate",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Delegate work to another agent/subagent.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent", notes: "Handoffs and agents-as-tools cover delegation semantics." },
      anthropic: { status: "documented", preferredLayer: "agent", notes: "Subagents are documented." },
      deepmind: { status: "documented", preferredLayer: "agent", notes: "Multi-agent and transfers are documented." }
    }
  }),
  defineCapability({
    key: "agent.handoff",
    namespace: "agent",
    action: "handoff",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Transfer runtime control from one agent to another.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "inferred", preferredLayer: "agent" },
      deepmind: { status: "documented", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "agent.asTool",
    namespace: "agent",
    action: "asTool",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Expose an agent as a callable tool within another runtime.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "inferred", preferredLayer: "agent" },
      deepmind: { status: "documented", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "file.upload",
    namespace: "file",
    action: "upload",
    plane: "resource",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Upload a platform file resource.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "file.list",
    namespace: "file",
    action: "list",
    plane: "resource",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "List platform file resources.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "file.read",
    namespace: "file",
    action: "read",
    plane: "resource",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Read or fetch a platform file resource.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "file.remove",
    namespace: "file",
    action: "remove",
    plane: "resource",
    pool: "core",
    weight: "thin",
    defaultLayer: "api",
    description: "Delete a platform file resource.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "batch.submit",
    namespace: "batch",
    action: "submit",
    plane: "resource",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Submit a batch job.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "batch.status",
    namespace: "batch",
    action: "status",
    plane: "resource",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Check the status of a batch job.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "batch.cancel",
    namespace: "batch",
    action: "cancel",
    plane: "resource",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Cancel a batch job.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "batch.result",
    namespace: "batch",
    action: "result",
    plane: "resource",
    pool: "shared",
    weight: "thin",
    defaultLayer: "api",
    description: "Collect the result set of a completed batch job.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "api" },
      anthropic: { status: "documented", preferredLayer: "api" },
      deepmind: { status: "documented", preferredLayer: "api" }
    }
  }),
  defineCapability({
    key: "trace.start",
    namespace: "trace",
    action: "start",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Start a trace or runtime observation session.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "unconfirmed" },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "Callbacks/eval can be composed into tracing-like behavior." }
    }
  }),
  defineCapability({
    key: "trace.span",
    namespace: "trace",
    action: "span",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Start or record a trace span.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "unconfirmed" },
      deepmind: { status: "inferred", preferredLayer: "agent" }
    }
  }),
  defineCapability({
    key: "trace.event",
    namespace: "trace",
    action: "event",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "Record a trace event or evidence point.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "inferred", preferredLayer: "agent", notes: "Hooks/logging can emit trace-like events." },
      deepmind: { status: "inferred", preferredLayer: "agent", notes: "Callbacks can emit trace-like events." }
    }
  }),
  defineCapability({
    key: "trace.end",
    namespace: "trace",
    action: "end",
    plane: "runtime",
    pool: "shared",
    weight: "thick",
    defaultLayer: "agent",
    description: "End a trace or close a trace span/session.",
    providerSupport: {
      openai: { status: "documented", preferredLayer: "agent" },
      anthropic: { status: "unconfirmed" },
      deepmind: { status: "inferred", preferredLayer: "agent" }
    }
  })
] as const;

export function listCapabilities(): readonly CapabilityDefinition[] {
  return CAPABILITY_REGISTRY;
}

export function getCapabilityDefinition(key: CapabilityKey): CapabilityDefinition | undefined {
  return CAPABILITY_REGISTRY.find((entry) => entry.key === key);
}

export function listCapabilitiesForProvider(
  provider: ProviderId,
  minimumStatus?: Exclude<SupportStatus, "unsupported">
): CapabilityDefinition[] {
  const statusOrder: Record<SupportStatus, number> = {
    unsupported: 0,
    unconfirmed: 1,
    inferred: 2,
    documented: 3
  };

  const threshold = minimumStatus ? statusOrder[minimumStatus] : 1;

  return CAPABILITY_REGISTRY.filter((entry) => {
    const support = entry.providerSupport[provider];
    return statusOrder[support.status] >= threshold;
  });
}
