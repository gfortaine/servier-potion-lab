import { spawnSync } from "node:child_process";

const containerName = "servier-potion-lab-dev";
const databaseUrl = "postgresql://servier:servier@127.0.0.1:54322/servier";

run("node", ["scripts/preflight.mjs", "--ports-only"]);
ensurePostgres();
run("pnpm", ["db:reset"], { DATABASE_URL: databaseUrl });

const result = spawnSync("pnpm", ["dev:raw"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    WEB_ORIGIN: "http://localhost:3000,http://127.0.0.1:3000",
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001"
  }
});

process.exitCode = result.status ?? 1;

function ensurePostgres() {
  const runResult = spawnSync("docker", [
    "run",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=servier",
    "-e",
    "POSTGRES_PASSWORD=servier",
    "-e",
    "POSTGRES_DB=servier",
    "-p",
    "127.0.0.1:54322:5432",
    "-d",
    "postgres:16-alpine"
  ], { stdio: "ignore" });

  if (runResult.status !== 0) {
    spawnSync("docker", ["start", containerName], { stdio: "ignore" });
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", [
      "exec",
      containerName,
      "pg_isready",
      "-U",
      "servier",
      "-d",
      "servier"
    ]);
    if (ready.status === 0) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }

  throw new Error("PostgreSQL dev container did not become ready.");
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env
    }
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
