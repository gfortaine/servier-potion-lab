"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Link, usePathname } from "../../i18n/navigation";
import type { LabView, Locale } from "../../i18n/routing";
import { potionCopy } from "../potion-copy";

const navViews: readonly LabView[] = ["dashboard", "recipes", "composer", "inventory"];
const labViewPathnames = {
  dashboard: "/",
  composer: "/composer",
  recipes: "/recipes",
  inventory: "/inventory"
} as const satisfies Record<LabView, "/" | "/composer" | "/recipes" | "/inventory">;

export function AppShell({
  children,
  locale
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
}): React.ReactElement {
  const copy = potionCopy[locale];
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lab-content">
        {locale === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>
      <aside className="cockpit-sidebar trace-line-r" aria-label={locale === "fr" ? "Laboratoire SERVIER" : "SERVIER lab"}>
        <Link className="sidebar-lockup brand-lockup interactive-press" href="/">
          <Image
            alt="SERVIER"
            className="servier-logo"
            height={31}
            priority
            src="/brand/servier-logo.svg"
            width={156}
          />
          <span>
            <strong>{locale === "fr" ? "Laboratoire SERVIER" : "SERVIER lab"}</strong>
            <small>{copy.brand.signature}</small>
          </span>
        </Link>
        <p className="brand-promise">{copy.brand.promise}</p>
        <nav className="sidebar-nav" aria-label={copy.nav.aria}>
          {navViews.map((view) => {
            const href = labViewPathnames[view];
            const label = copy.nav[view][0];
            const detail = copy.nav[view][1];
            const current = isCurrentView(pathname, view);

            return (
              <Link aria-current={current ? "page" : undefined} href={href} key={view}>
                <span className="sidebar-icon" aria-hidden="true">
                  {viewIcon(view)}
                </span>
                <span>
                  <span>{label}</span>
                  <strong>{detail}</strong>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-actions" aria-hidden="true">
          <button type="button">{locale === "fr" ? "Vérifier le lab" : "Check lab"}</button>
          <small>{locale === "fr" ? "État système" : "System status"}</small>
          <small>Support</small>
        </div>
      </aside>
      <div id="lab-content">{children}</div>
    </div>
  );
}

function isCurrentView(pathname: string, view: LabView): boolean {
  return pathname === labViewPathnames[view];
}

function viewIcon(view: LabView): string {
  const icons = {
    dashboard: "01",
    recipes: "02",
    composer: "03",
    inventory: "04"
  } as const satisfies Record<LabView, string>;

  return icons[view];
}
