import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function loadLocalEnv(): void {
  const root = findWorkspaceRoot(process.cwd());
  const appRoot = join(root, "apps", "api");
  const candidates = [
    join(root, ".env.local"),
    join(root, ".env"),
    join(appRoot, ".env.local"),
    join(appRoot, ".env")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loadEnvFile(candidate);
    }
  }
}

function findWorkspaceRoot(start: string): string {
  let current = start;
  while (current !== dirname(current)) {
    const packageJson = join(current, "package.json");
    if (existsSync(packageJson) && readFileSync(packageJson, "utf8").includes('"name": "servier-potion-lab"')) {
      return current;
    }
    current = dirname(current);
  }
  return start;
}

function loadEnvFile(path: string): void {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);
    if (!parsed || process.env[parsed.key] !== undefined) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }
}

function parseEnvLine(line: string): { readonly key: string; readonly value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex < 1) {
    return null;
  }
  const key = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
    return null;
  }
  return {
    key,
    value: stripEnvQuotes(trimmed.slice(separatorIndex + 1).trim())
  };
}

function stripEnvQuotes(value: string): string {
  const quote = value[0];
  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
}
