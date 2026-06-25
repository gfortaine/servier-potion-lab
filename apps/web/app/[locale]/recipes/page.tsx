import { setRequestLocale } from "next-intl/server";
import { PotionGame } from "../../potion-game";
import { isLocale, type Locale } from "../../../i18n/routing";

export default async function LocalizedRecipesPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ created?: string; recipe?: string }>;
}): Promise<React.ReactElement> {
  const { locale: rawLocale } = await params;
  const { created, recipe } = await searchParams;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "fr";
  setRequestLocale(locale);

  return (
    <PotionGame
      initialCreatedPotionId={created}
      initialCreatedRecipeId={recipe}
      locale={locale}
      view="recipes"
    />
  );
}
