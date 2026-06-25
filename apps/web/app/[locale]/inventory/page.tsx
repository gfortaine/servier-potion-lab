import { setRequestLocale } from "next-intl/server";
import { PotionGame } from "../../potion-game";
import { isLocale, type Locale } from "../../../i18n/routing";

export default async function LocalizedInventoryPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ingredient?: string }>;
}): Promise<React.ReactElement> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "fr";
  const { ingredient } = await searchParams;
  setRequestLocale(locale);

  return <PotionGame focusedIngredientId={ingredient} locale={locale} view="inventory" />;
}
