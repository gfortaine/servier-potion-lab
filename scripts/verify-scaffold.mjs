import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "README.md",
  "docs/architecture.md",
  "apps/web/package.json",
  "apps/web/app/page.tsx",
  "apps/api/package.json",
  "apps/api/src/main.ts",
  "packages/domain/package.json",
  "packages/domain/src/domain/recipeMatching.ts",
  "packages/db/package.json",
  "packages/db/prisma/schema.prisma",
  "packages/db/prisma/migrations/20260621234500_initial/migration.sql",
  "packages/typescript-config/package.json",
  "packages/typescript-config/base.json",
  "packages/typescript-config/nextjs.json",
  "packages/typescript-config/nestjs.json"
];

for (const filePath of requiredFiles) {
  await access(join(root, filePath));
}

const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const workspaceFile = await readFile(join(root, "pnpm-workspace.yaml"), "utf8");
const expectedWorkspaces = ["apps/*", "packages/*"];

for (const workspace of expectedWorkspaces) {
  if (!workspaceFile.includes(`"${workspace}"`)) {
    throw new Error(`Missing pnpm workspace glob: ${workspace}`);
  }
}

if (rootPackage.packageManager !== "pnpm@10.11.0") {
  throw new Error("Root packageManager must be pinned to pnpm@10.11.0.");
}

if (!rootPackage.scripts?.verify?.includes("turbo run")) {
  throw new Error("Root verify script must run through Turborepo.");
}

try {
  await access(join(root, "package-lock.json"));
  throw new Error("package-lock.json must not exist after pnpm migration.");
} catch (error) {
  if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
    throw error;
  }
}

const domainSource = await readFile(
  join(root, "packages/domain/src/domain/recipeMatching.ts"),
  "utf8"
);

if (!domainSource.includes("difa_findRecipeByIngredients")) {
  throw new Error("The real difa_ domain function is missing.");
}

const readme = await readFile(join(root, "README.md"), "utf8");
for (const expected of ["Next.js", "NestJS", "PostgreSQL", "Prisma", "Azure Container Apps"]) {
  if (!readme.includes(expected)) {
    throw new Error(`README is missing stack signal: ${expected}`);
  }
}

console.log("SERVIER scaffold verification passed");
