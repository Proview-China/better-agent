import { restoreWorkspaceGitCheckpoint } from "./workspace-git-checkpoint.js";

interface RestoreWorkspaceGitCheckpointRunnerInput {
  sessionId: string;
  workspaceRoot: string;
  checkpointRef: string;
  agentId: string;
}

interface RestoreWorkspaceGitCheckpointRunnerOutput {
  ok: true;
  result: Awaited<ReturnType<typeof restoreWorkspaceGitCheckpoint>>;
}

async function readStdin(): Promise<string> {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

async function main(): Promise<void> {
  const rawInput = (await readStdin()).trim();
  if (rawInput.length === 0) {
    throw new Error("Missing restore runner input.");
  }
  const input = JSON.parse(rawInput) as RestoreWorkspaceGitCheckpointRunnerInput;
  const result = await restoreWorkspaceGitCheckpoint(input);
  const output: RestoreWorkspaceGitCheckpointRunnerOutput = {
    ok: true,
    result,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
