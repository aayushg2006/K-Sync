import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  if (process.env.RUN_MIGRATIONS_ON_STARTUP === "true") {
    await runCommand(npmCommand, ["run", "db:deploy"]);
  }

  if (process.env.RUN_SEED_ON_STARTUP === "true") {
    await runCommand(npmCommand, ["run", "db:seed"]);
  }

  await runCommand(nodeCommand, ["dist/server.js"]);
}

main().catch((error) => {
  console.error("[entrypoint] startup failed:", error.message);
  process.exit(1);
});
