import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const defaultRedisUrl = "redis://localhost:6380";

let shuttingDown = false;
const children = [];
let selectedFrontendPort = 5173;
let selectedBackendPort = 8080;
let selectedRedisUrl = process.env.REDIS_URL ?? defaultRedisUrl;

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort) {
  let candidate = startPort;

  while (!(await checkPortAvailability(candidate))) {
    candidate += 1;
  }

  return candidate;
}

function buildSharedEnv() {
  return {
    ...process.env,
    FRONTEND_URL: `http://localhost:${selectedFrontendPort}`,
    PORT: String(selectedBackendPort),
    REDIS_URL: selectedRedisUrl,
    VITE_API_BASE_URL: `http://localhost:${selectedBackendPort}`,
  };
}

function writePrefixed(outputStream, label, chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }

    outputStream.write(`[${label}] ${line}\n`);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 200);
}

function startChild(service) {
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", service.command], {
          cwd: service.cwd,
          env: service.env,
          shell: false,
          stdio: ["inherit", "pipe", "pipe"],
          windowsHide: true,
        })
      : spawn(npmCommand, service.args, {
          cwd: service.cwd,
          env: service.env,
          shell: false,
          stdio: ["inherit", "pipe", "pipe"],
          windowsHide: true,
        });

  child.stdout.on("data", (chunk) => writePrefixed(process.stdout, service.label, chunk));
  child.stderr.on("data", (chunk) => writePrefixed(process.stderr, service.label, chunk));

  child.on("exit", (code) => {
    if (!shuttingDown) {
      shutdown(code ?? 0);
    }
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  selectedFrontendPort = await findAvailablePort(5173);
  selectedBackendPort = await findAvailablePort(8080);

  const sharedEnv = buildSharedEnv();
  const services = [
    {
      label: "backend",
      cwd: path.join(projectRoot, "backend"),
      args: ["run", "dev"],
      command: "npm run dev",
      env: sharedEnv,
    },
    {
      label: "frontend",
      cwd: path.join(projectRoot, "frontend"),
      args: ["run", "dev", "--", "--port", String(selectedFrontendPort)],
      command: `npm run dev -- --port ${selectedFrontendPort}`,
      env: sharedEnv,
    },
  ];

  process.stdout.write(
    `[dev-start] backend=http://localhost:${selectedBackendPort} frontend=http://localhost:${selectedFrontendPort} redis=${selectedRedisUrl}\n`,
  );

  for (const service of services) {
    startChild(service);
  }
}

void main().catch((error) => {
  process.stderr.write(`[dev-start] failed to start services: ${error.message}\n`);
  process.exit(1);
});
