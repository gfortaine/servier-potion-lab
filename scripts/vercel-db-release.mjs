import { spawnSync } from "node:child_process";

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("Vercel database release failed: DATABASE_URL is required.");
  process.exit(1);
}

run("pnpm", ["--filter", "@servier-potion-lab/db", "db:migrate"]);

if (process.env.VERCEL_ENV === "preview") {
  run("pnpm", ["--filter", "@servier-potion-lab/db", "db:seed"]);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
