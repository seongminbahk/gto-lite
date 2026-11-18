import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/messages";
import { aboutContent } from "@/lib/i18n/aboutContent";
import { localePath } from "@/lib/i18n/paths";
import { SITE_NAME, siteUrl } from "@/lib/siteUrl";
import { rangeCopy } from "./rangeCopy";
import { siteCopy } from "./siteCopy";
import { RANGES_INDEX_PATH, spotPath, type SpotPage } from "./spotPages";
import type { RangeStats } from "./spotSummary";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", ko: "ko_KR" };

/**
 * A page's own address and its twin in the other language, for
 * <link rel="canonical"> and hreflang. `path` is the English address.
 */
export function pageAlternates(locale: Locale, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localePath(locale, path),
    languages: { en: path, ko: localePath("ko", path), "x-default": path },
  };
}

/** What every page in one language starts from; the preview image and icons come from the files in app/. */
export function rootMetadata(locale: Locale): Metadata {
  const { title, description } = siteCopy(locale);
  // Search Console's HTML-tag check, only when the site is verified that way rather than by DNS.
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${SITE_NAME}` },
    description,
    applicationName: SITE_NAME,
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url: localePath(locale, "/"), locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image", title, description },
    ...(googleVerification ? { verification: { google: googleVerification } } : {}),
  };
}

/** A page's title, description and addresses, with the share preview saying the same. */
export function pageMetadata(locale: Locale, path: string, title: string | undefined, description: string): Metadata {
  const shown = title ? `${title} · ${SITE_NAME}` : siteCopy(locale).title;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: pageAlternates(locale, path),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: shown,
      description,
      url: localePath(locale, path),
      locale: OG_LOCALE[locale],
    },
    twitter: { card: "summary_large_image", title: shown, description },
  };
}

export function homeMetadata(locale: Locale): Metadata {
  return pageMetadata(locale, "/", undefined, siteCopy(locale).description);
}

// The English page title is "About · gtoLite"; Korean reads the same way, rather than naming the site twice.
const ABOUT_TITLE: Record<Locale, string> = { en: "About", ko: "소개" };

const ABOUT_DESCRIPTION: Record<Locale, string> = {
  en: "How gtoLite makes its preflop ranges and solves postflop, how accurate it is, and what it doesn't do.",
  ko: aboutContent("ko").lead,
};

export function aboutMetadata(locale: Locale): Metadata {
  return pageMetadata(locale, "/about", ABOUT_TITLE[locale], ABOUT_DESCRIPTION[locale]);
}

export function rangesIndexMetadata(locale: Locale): Metadata {
  const { title, description } = rangeCopy(locale).index;
  return pageMetadata(locale, RANGES_INDEX_PATH, title, description);
}

export function spotMetadata(locale: Locale, page: SpotPage, stats: RangeStats): Metadata {
  const copy = rangeCopy(locale);
  return pageMetadata(locale, spotPath(page), copy.title(page, stats), copy.description(page, stats));
}
