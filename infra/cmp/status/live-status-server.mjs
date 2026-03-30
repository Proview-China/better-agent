import http from "node:http";
import net from "node:net";
import { stat } from "node:fs/promises";
import path from "node:path";

const STATUS_PORT = Number(process.env.CMP_STATUS_PORT || "57480");
const POSTGRES_HOST = process.env.CMP_POSTGRES_HOST || "127.0.0.1";
const POSTGRES_PORT = Number(process.env.CMP_POSTGRES_PORT || "5432");
const REDIS_HOST = process.env.CMP_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.CMP_REDIS_PORT || "6379");
const GIT_REPO_ROOT = process.env.CMP_GIT_REPO_ROOT || "/srv/cmp/repos";
const GIT_REPO_NAME = process.env.CMP_GIT_REPO_NAME || "main.git";

function tcpCheck(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (healthy, detail) => {
      socket.destroy();
      resolve({
        healthy,
        detail,
      });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, `${host}:${port} reachable`));
    socket.once("timeout", () => finish(false, `${host}:${port} timeout`));
    socket.once("error", (error) => finish(false, error.message));
  });
}

async function directoryCheck(targetPath) {
  try {
    const result = await stat(targetPath);
    return {
      healthy: result.isDirectory(),
      detail: result.isDirectory() ? `${targetPath} present` : `${targetPath} is not a directory`,
    };
  } catch (error) {
    return {
      healthy: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createStatusSnapshot() {
  const gitTarget = path.join(GIT_REPO_ROOT, GIT_REPO_NAME);
  const [postgres, redis, git] = await Promise.all([
    tcpCheck(POSTGRES_HOST, POSTGRES_PORT),
    tcpCheck(REDIS_HOST, REDIS_PORT),
    directoryCheck(gitTarget),
  ]);
  const services = {
    postgres: {
      host: POSTGRES_HOST,
      port: POSTGRES_PORT,
      healthy: postgres.healthy,
      detail: postgres.detail,
    },
    redis: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      healthy: redis.healthy,
      detail: redis.detail,
    },
    git: {
      repoRoot: GIT_REPO_ROOT,
      repoName: GIT_REPO_NAME,
      healthy: git.healthy,
      detail: git.detail,
    },
  };
  const healthy = Object.values(services).every((service) => service.healthy);
  return {
    status: healthy ? "ready" : "degraded",
    generatedAt: new Date().toISOString(),
    services,
  };
}

const server = http.createServer(async (request, response) => {
  const snapshot = await createStatusSnapshot();
  if (request.url === "/healthz") {
    response.writeHead(snapshot.status === "ready" ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({
      status: snapshot.status,
      generatedAt: snapshot.generatedAt,
    }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(snapshot, null, 2));
});

server.listen(STATUS_PORT, "0.0.0.0", () => {
  process.stdout.write(`CMP status panel listening on ${STATUS_PORT}\n`);
});
