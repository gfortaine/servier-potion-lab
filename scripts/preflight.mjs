import { execFileSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const apiOnly = args.has("--api-only");
const webOnly = args.has("--web-only");
const portsOnly = args.has("--ports-only");

const ports = apiOnly ? [3001] : webOnly ? [3000] : [3000, 3001];
const blockers = ports.flatMap((port) => findPortBlockers(port));

if (blockers.length > 0) {
  console.error("Startup preflight failed: required ports are already in use.");
  for (const blocker of blockers) {
    console.error(`\nPort ${blocker.port}:`);
    console.error(blocker.output);
  }
  console.error("\nStop the exact PID shown above, then rerun the command.");
  process.exit(1);
}

if (!portsOnly && !webOnly) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "Startup preflight failed: DATABASE_URL is missing. Use `pnpm dev` for the Docker-backed local stack, or set DATABASE_URL before starting the API."
    );
    process.exit(1);
  }
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    console.error("Startup preflight failed: DATABASE_URL must use postgresql:// or postgres://.");
    process.exit(1);
  }
}

function findPortBlockers(port) {
  try {
    const output = execFileSync("lsof", [
      "-nP",
      `-iTCP:${port}`,
      "-sTCP:LISTEN"
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    return output ? [{ port, output }] : [];
  } catch {
    return [];
  }
}
