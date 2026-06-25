import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PotionGame } from "../potion-game";
import { isLocale, localizedPaths, type Locale } from "../../i18n/routing";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "fr";
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localizedPaths[locale].dashboard,
      languages: {
        fr: localizedPaths.fr.dashboard,
        en: localizedPaths.en.dashboard
      }
    }
  };
}

export default async function LocalizedHomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.ReactElement> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "fr";
  setRequestLocale(locale);

  return <PotionGame locale={locale} />;
}
