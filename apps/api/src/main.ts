import "reflect-metadata";
import { loadLocalEnv } from "./local-env.js";
import { createConfiguredNestApp } from "./bootstrap.js";

const DEFAULT_PORT = 3001;

loadLocalEnv();

async function bootstrap(): Promise<void> {
  // createConfiguredNestApp keeps configureOpenApi wired for both local and Vercel entrypoints.
  const app = await createConfiguredNestApp();
  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

await bootstrap();
