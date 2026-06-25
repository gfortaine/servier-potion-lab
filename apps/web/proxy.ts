import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const legacyFrenchRoutes = new Map([
  ["/", "/fr"],
  ["/composer", "/fr/composer-une-potion"],
  ["/recipes", "/fr/recettes"],
  ["/inventory", "/fr/inventaire"]
]);

export default function proxy(request: NextRequest): NextResponse {
  const legacyTarget = legacyFrenchRoutes.get(request.nextUrl.pathname);
  if (legacyTarget) {
    return NextResponse.redirect(new URL(legacyTarget, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
