"use client";

import { useEffect } from "react";
import { languageSwitchHref, setLocale, useLocale, useMessages } from "@/lib/i18n/locale";
import { loadPage } from "@/lib/i18n/loadPage";
import type { Locale } from "@/lib/i18n/messages";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "ko", label: "한" },
];

/**
 * Switches the whole page, and the AI explanation, between English and
 * Korean without touching the hand: the choice is remembered, and the page
 * moves to its address in that language (/ ↔ /ko) with the spot in the query.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const t = useMessages();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function choose(next: Locale) {
    setLocale(next);
    const { pathname, search, hash } = window.location;
    const href = languageSwitchHref(pathname, search, hash, next);
    if (href) loadPage(href);
  }

  return (
    <div role="group" aria-label={t.language} className="flex shrink-0 overflow-hidden rounded border border-line-strong text-sm">
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          aria-pressed={locale === option.locale}
          onClick={() => choose(option.locale)}
          className={`px-2 py-1 pointer-coarse:min-h-9 ${
            locale === option.locale ? "bg-raised font-medium text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
