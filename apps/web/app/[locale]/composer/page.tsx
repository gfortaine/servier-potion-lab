import { setRequestLocale } from "next-intl/server";
import { PotionGame } from "../../potion-game";
import { isLocale, type Locale } from "../../../i18n/routing";

export default async function LocalizedComposerPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ recipe?: string }>;
}): Promise<React.ReactElement> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "fr";
  const { recipe } = await searchParams;
  setRequestLocale(locale);

  return <PotionGame initialTargetRecipeId={recipe} locale={locale} view="composer" />;
}
