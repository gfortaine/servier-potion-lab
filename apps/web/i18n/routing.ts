import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/composer": {
      en: "/composer",
      fr: "/composer-une-potion"
    },
    "/recipes": {
      en: "/recipes",
      fr: "/recettes"
    },
    "/inventory": {
      en: "/inventory",
      fr: "/inventaire"
    }
  }
});

export type Locale = (typeof routing.locales)[number];
export type LabView = "dashboard" | "composer" | "recipes" | "inventory";

export const localizedPaths: Record<Locale, Record<LabView, string>> = {
  fr: {
    dashboard: "/fr",
    composer: "/fr/composer-une-potion",
    recipes: "/fr/recettes",
    inventory: "/fr/inventaire"
  },
  en: {
    dashboard: "/en",
    composer: "/en/composer",
    recipes: "/en/recipes",
    inventory: "/en/inventory"
  }
};

export function isLocale(value: string): value is Locale {
  return routing.locales.includes(value as Locale);
}

export function localizedPath(
  locale: Locale,
  view: LabView,
  params: Record<string, string | undefined> = {}
): string {
  const path = localizedPaths[locale][view];
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}
