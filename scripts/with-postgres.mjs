import { execFileSync, spawnSync } from "node:child_process";

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("Usage: node scripts/with-postgres.mjs <command> [...args]");
  process.exit(2);
}

const providedDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (providedDatabaseUrl) {
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? providedDatabaseUrl,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? providedDatabaseUrl
    }
  });
  process.exit(result.status ?? 1);
}

const containerName = `servier-potion-lab-test-${process.pid}-${Date.now()}`;

function runDocker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: "pipe", ...options });
}

try {
  runDocker([
    "run",
    "--rm",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=servier",
    "-e",
    "POSTGRES_PASSWORD=servier",
    "-e",
    "POSTGRES_DB=servier",
    "-p",
    "127.0.0.1::5432",
    "-d",
    "postgres:16-alpine"
  ]);

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
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    if (attempt === 59) {
      throw new Error("PostgreSQL test container did not become ready.");
    }
  }

  const portLine = runDocker(["port", containerName, "5432/tcp"]).trim();
  const port = portLine.split(":").at(-1);
  if (!port) {
    throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);
  }

  const databaseUrl = `postgresql://servier:servier@127.0.0.1:${port}/servier`;
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      TEST_DATABASE_URL: databaseUrl
    }
  });

  process.exitCode = result.status ?? 1;
} finally {
  spawnSync("docker", ["stop", containerName], { stdio: "ignore" });
}
