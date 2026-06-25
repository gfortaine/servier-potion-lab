import "reflect-metadata";
import express from "express";
import type { Express } from "express";
import { createConfiguredNestApp } from "./bootstrap.js";

const server: Express = express();

server.use((request, _response, next) => {
  if (request.url === "/api") {
    request.url = "/";
  } else if (request.url.startsWith("/api/")) {
    request.url = request.url.slice("/api".length);
  }
  next();
});

await createConfiguredNestApp(server).then((app) => app.init());

export default server;
