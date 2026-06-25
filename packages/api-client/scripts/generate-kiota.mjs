#!/usr/bin/env node
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const openApiPath = join(packageRoot, "openapi", "servier-openapi.json");
const outputPath = join(packageRoot, "src", "generated");
const kiotaBinary = process.env.KIOTA_BINARY ?? "kiota";

await rm(outputPath, { recursive: true, force: true });

const result = spawnSync(
  kiotaBinary,
  [
    "generate",
    "-l",
    "typescript",
    "-d",
    openApiPath,
    "-c",
    "ServierPotionLabClient",
    "-o",
    outputPath,
    "--exclude-backward-compatible"
  ],
  { stdio: "inherit" }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`Kiota generation failed with exit code ${result.status ?? "unknown"}.`);
}

await normalizeExactOptionalPropertyTypes(outputPath);

async function normalizeExactOptionalPropertyTypes(path) {
  const entries = await readdir(path, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) {
        await normalizeExactOptionalPropertyTypes(entryPath);
        return;
      }
      if (!entry.name.endsWith(".ts")) {
        return;
      }

      const source = await readFile(entryPath, "utf8");
      const normalized = source.replace(
        /\?: ([^;\n]+?) \| null;/g,
        (match, type) => (type.includes("undefined") ? match : `?: ${type} | null | undefined;`)
      );
      if (normalized !== source) {
        await writeFile(entryPath, normalized);
      }
    })
  );
}
