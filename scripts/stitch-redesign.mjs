import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const designRoot = join(repoRoot, "docs", "design", "stitch");
const promptRoot = join(designRoot, "prompts");
const outputRoot = join(repoRoot, ".stitch", "designs");

const allScreens = [
  { slug: "dashboard", prompt: "dashboard.md", deviceType: "DESKTOP" },
  { slug: "composer", prompt: "composer.md", deviceType: "DESKTOP" },
  { slug: "recipes", prompt: "recipes.md", deviceType: "DESKTOP" },
  { slug: "inventory", prompt: "inventory.md", deviceType: "DESKTOP" },
  { slug: "chat", prompt: "chat.md", deviceType: "DESKTOP" },
  { slug: "mobile", prompt: "mobile.md", deviceType: "MOBILE" }
];
const selectedSlugs = new Set((process.env.STITCH_SCREEN_SLUGS ?? "").split(",").map((slug) => slug.trim()).filter(Boolean));
const screens = selectedSlugs.size === 0 ? allScreens : allScreens.filter((screen) => selectedSlugs.has(screen.slug));
const timeoutMs = Number(process.env.STITCH_TIMEOUT_MS ?? "420000");

await mkdir(outputRoot, { recursive: true });

const designSystem = await readFile(join(designRoot, "DESIGN.md"), "utf8");
const projectTitle = process.env.STITCH_PROJECT_TITLE ?? "SERVIER Potion Lab";

if (!process.env.STITCH_API_KEY) {
  await writeJson(join(outputRoot, "manifest.json"), {
    status: "pending_api_key",
    projectTitle,
    generatedAt: new Date().toISOString(),
    message: "Set STITCH_API_KEY in the shell environment to generate Stitch screens. Do not commit API keys.",
    screens: await Promise.all(
      screens.map(async (screen) => ({
        slug: screen.slug,
        deviceType: screen.deviceType,
        promptFile: join("docs", "design", "stitch", "prompts", screen.prompt),
        promptPreview: (await readFile(join(promptRoot, screen.prompt), "utf8")).slice(0, 240)
      }))
    )
  });
  console.log("Stitch generation deferred: STITCH_API_KEY is not set. Wrote .stitch/designs/manifest.json.");
  process.exit(0);
}

const { stitch } = await import("@google/stitch-sdk");
console.log(`Preparing Stitch project "${projectTitle}" for ${screens.length} screen(s).`);
const project =
  process.env.STITCH_PROJECT_ID === undefined || process.env.STITCH_PROJECT_ID === ""
    ? await withTimeout(stitch.createProject(projectTitle), timeoutMs, "create Stitch project")
    : stitch.project(process.env.STITCH_PROJECT_ID);
console.log(`Using Stitch project ${project.projectId}.`);

const generatedScreens = [];
const manifestPath = join(outputRoot, "manifest.json");
for (const screen of screens) {
  console.log(`Generating ${screen.slug} (${screen.deviceType})...`);
  const routePrompt = await readFile(join(promptRoot, screen.prompt), "utf8");
  const fullPrompt = [
    "Use this design system as the source of truth:",
    designSystem,
    "",
    "Generate this screen:",
    routePrompt
  ].join("\n");
  const generated = await withTimeout(
    project.generate(fullPrompt, screen.deviceType),
    timeoutMs,
    `generate ${screen.slug}`
  );
  console.log(`Generated ${screen.slug} as screen ${generated.screenId}. Downloading assets...`);
  const htmlUrl = await withTimeout(generated.getHtml(), timeoutMs, `get ${screen.slug} HTML URL`);
  const imageUrl = await withTimeout(generated.getImage(), timeoutMs, `get ${screen.slug} image URL`);
  const htmlPath = join(outputRoot, `${screen.slug}.html`);
  const imagePath = join(outputRoot, `${screen.slug}.png`);

  await withTimeout(download(htmlUrl, htmlPath), timeoutMs, `download ${screen.slug} HTML`);
  await withTimeout(download(imageUrl, imagePath), timeoutMs, `download ${screen.slug} screenshot`);

  generatedScreens.push({
    slug: screen.slug,
    deviceType: screen.deviceType,
    screenId: generated.screenId,
    projectId: generated.projectId,
    html: htmlPath.replace(`${repoRoot}/`, ""),
    image: imagePath.replace(`${repoRoot}/`, "")
  });
  console.log(`Saved ${screen.slug} HTML and screenshot.`);
}

const previousManifest = await readJson(manifestPath);
const previousScreens =
  previousManifest?.status === "generated" && previousManifest.projectId === project.projectId
    ? previousManifest.screens.filter(
        (previousScreen) => !generatedScreens.some((generatedScreen) => generatedScreen.slug === previousScreen.slug)
      )
    : [];
const mergedScreens = [...previousScreens, ...generatedScreens].sort(
  (left, right) =>
    allScreens.findIndex((screen) => screen.slug === left.slug) - allScreens.findIndex((screen) => screen.slug === right.slug)
);

await writeJson(manifestPath, {
  status: "generated",
  projectTitle,
  projectId: project.projectId,
  generatedAt: new Date().toISOString(),
  screens: mergedScreens
});
console.log(`Generated ${generatedScreens.length} Stitch screens for project ${project.projectId}.`);

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}
