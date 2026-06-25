import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  health(): { readonly status: "ok"; readonly service: "servier-potion-lab-api" } {
    return { status: "ok", service: "servier-potion-lab-api" };
  }

  @Get("ready")
  ready(): { readonly status: "ready"; readonly dependencies: readonly string[] } {
    return { status: "ready", dependencies: ["domain", "postgresql"] };
  }
}

