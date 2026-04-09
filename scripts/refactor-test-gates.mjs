import { spawn } from "node:child_process";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;

const baselineSteps = [
  {
    label: "typecheck",
    command: npmCommand,
    args: ["run", "typecheck"],
  },
  {
    label: "build",
    command: npmCommand,
    args: ["run", "build"],
  },
  {
    label: "test",
    command: npmCommand,
    args: ["test"],
  },
];

const gateDefinitions = {
  baseline: {
    title: "仓库级冻结基线",
    files: [],
    focusedSuites: [],
    notes: [
      "所有大文件拆分前后都必须先过这一组基线。",
      "这组基线固定为 npm run typecheck / npm run build / npm test。",
    ],
  },
  "live-agent-chat": {
    title: "live-agent-chat 拆分前门槛",
    files: ["src/agent_core/live-agent-chat.ts"],
    focusedSuites: [
      {
        label: "live-agent-chat shared utilities",
        files: [
          "src/agent_core/live-agent-chat/shared.test.ts",
        ],
      },
    ],
    notes: [
      "第一轮拆分后，先用 shared utilities focused suite 锁住参数解析、TAP 请求解析和 action envelope 解析行为。",
    ],
  },
  "tap-tooling-adapter": {
    title: "tap-tooling-adapter 拆分前门槛",
    files: [
      "src/agent_core/integrations/tap-tooling-adapter.ts",
    ],
    focusedSuites: [
      {
        label: "tap-tooling baseline + inventory",
        files: [
          "src/agent_core/integrations/tap-tooling-adapter.test.ts",
          "src/agent_core/capability-package/tap-tooling-baseline.test.ts",
          "src/agent_core/tap-availability/formal-family-inventory.test.ts",
        ],
      },
    ],
    notes: [
      "不允许改公开导出路径、函数名或 helper ref 字符串。",
    ],
  },
  "capability-package": {
    title: "capability-package 拆分前门槛",
    files: [
      "src/agent_core/capability-package/capability-package.ts",
    ],
    focusedSuites: [
      {
        label: "capability package regression",
        files: [
          "src/agent_core/capability-package/capability-package.test.ts",
          "src/agent_core/capability-package/skill-family-capability-package.test.ts",
          "src/agent_core/tap-availability/availability-contract.test.ts",
          "src/agent_core/integrations/rax-mcp-adapter.test.ts",
          "src/agent_core/integrations/rax-skill-adapter.test.ts",
          "src/agent_core/ta-pool-runtime/activation-materializer.test.ts",
        ],
      },
    ],
    notes: [
      "先做内部重组，保持 capability-package/index.ts 的旧出口可用。",
    ],
  },
  runtime: {
    title: "AgentCoreRuntime 拆分前门槛",
    files: [
      "src/agent_core/runtime.ts",
    ],
    focusedSuites: [
      {
        label: "runtime mainline regression",
        files: [
          "src/agent_core/runtime.test.ts",
          "src/agent_core/runtime.recovery.test.ts",
          "src/agent_core/runtime.replay.test.ts",
          "src/agent_core/runtime.replay-continue.test.ts",
          "src/agent_core/runtime.cmp-live.test.ts",
          "src/agent_core/runtime.cmp-five-agent.test.ts",
          "src/agent_core/runtime.continue-followups.pickup-targeted.test.ts",
          "src/agent_core/runtime.continue-followups.auto-after-verify.test.ts",
          "src/agent_core/runtime.continue-followups.blocked.test.ts",
          "src/agent_core/runtime.continue-followups.waiting-human.test.ts",
        ],
      },
    ],
    notes: [
      "如果这次拆分碰到 live wrapper，再额外手跑 single-agent-live-smoke 和 cmp-five-agent-live-smoke。",
    ],
  },
  "rax-facades": {
    title: "rax facade / cmp-facade 拆分前门槛",
    files: [
      "src/rax/facade.ts",
      "src/rax/cmp-facade.ts",
    ],
    focusedSuites: [
      {
        label: "rax facade regression",
        files: [
          "src/rax/router.test.ts",
          "src/rax/mcp-runtime.test.ts",
          "src/rax/runtime.test.ts",
          "src/rax/cmp-facade.test.ts",
          "src/rax/skill-runtime.test.ts",
        ],
      },
    ],
    notes: [
      "先保持 createRaxFacade / createRaxCmpFacade 的出口不变。",
    ],
  },
  "workspace-network": {
    title: "workspace/network adapter 拆分前门槛",
    files: [
      "src/agent_core/integrations/workspace-read-adapter.ts",
      "src/agent_core/integrations/tap-vendor-network-adapter.ts",
    ],
    focusedSuites: [
      {
        label: "workspace + vendor network regression",
        files: [
          "src/agent_core/integrations/workspace-read-adapter.test.ts",
          "src/agent_core/integrations/tap-vendor-network-adapter.test.ts",
        ],
      },
    ],
    notes: [
      "拆分时保持 registerFirstClassToolingBaselineCapabilities / registerTapVendorNetworkCapabilityFamily 旧出口不变。",
    ],
  },
};

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function toDistTestPath(file) {
  if (!file.startsWith("src/") || !file.endsWith(".test.ts")) {
    throw new Error(`Focused suite file must be a src/*.test.ts path: ${file}`);
  }

  return path.posix.join("dist", file.slice("src/".length)).replace(/\.ts$/u, ".js");
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/refactor-test-gates.mjs list");
  console.log("  node scripts/refactor-test-gates.mjs show <gate>");
  console.log("  node scripts/refactor-test-gates.mjs run <gate>");
  console.log("");
  console.log("Available gates:");
  for (const [name, gate] of Object.entries(gateDefinitions)) {
    console.log(`  - ${name}: ${gate.title}`);
  }
}

function printBaseline() {
  console.log("Baseline steps:");
  for (const step of baselineSteps) {
    console.log(`- ${step.label}: ${formatCommand(step.command, step.args)}`);
  }
}

function printGate(name, gate) {
  console.log(`${name}: ${gate.title}`);
  if (gate.files.length > 0) {
    console.log("Files:");
    for (const file of gate.files) {
      console.log(`- ${file}`);
    }
  }

  if (gate.focusedSuites.length > 0) {
    console.log("Focused suites:");
    for (const suite of gate.focusedSuites) {
      console.log(`- ${suite.label}`);
      console.log(`  ${formatCommand(nodeCommand, ["--test", ...suite.files.map(toDistTestPath)])}`);
    }
  } else {
    console.log("Focused suites:");
    console.log("- none");
  }

  if (gate.notes.length > 0) {
    console.log("Notes:");
    for (const note of gate.notes) {
      console.log(`- ${note}`);
    }
  }
}

async function runCommand(step) {
  await new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `Command terminated by signal ${signal}: ${formatCommand(step.command, step.args)}`
            : `Command failed with exit code ${code}: ${formatCommand(step.command, step.args)}`,
        ),
      );
    });
  });
}

async function runGate(name, gate) {
  console.log(`Running gate: ${name}`);
  printBaseline();
  for (const step of baselineSteps) {
    await runCommand(step);
  }

  if (gate.focusedSuites.length === 0) {
    console.log(`No focused suites configured for ${name}; baseline only.`);
    return;
  }

  for (const suite of gate.focusedSuites) {
    console.log(`Running focused suite: ${suite.label}`);
    await runCommand({
      command: nodeCommand,
      args: ["--test", ...suite.files.map(toDistTestPath)],
    });
  }
}

async function main() {
  const [command, gateName] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  if (command === "list") {
    for (const [name, gate] of Object.entries(gateDefinitions)) {
      console.log(`- ${name}: ${gate.title}`);
    }
    return;
  }

  if (command === "show") {
    if (!gateName) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    const gate = gateDefinitions[gateName];
    if (!gate) {
      console.error(`Unknown gate: ${gateName}`);
      printUsage();
      process.exitCode = 1;
      return;
    }
    printBaseline();
    console.log("");
    printGate(gateName, gate);
    return;
  }

  if (command === "run") {
    if (!gateName) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    const gate = gateDefinitions[gateName];
    if (!gate) {
      console.error(`Unknown gate: ${gateName}`);
      printUsage();
      process.exitCode = 1;
      return;
    }
    await runGate(gateName, gate);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
