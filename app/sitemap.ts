import type { MetadataRoute } from "next";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { siteUrl } from "@/lib/siteUrl";

type Page = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number };

const LOCALES: Locale[] = ["en", "ko"];

/** Every page by its English address; each is listed once per language, naming its twins. */
const PAGES: Page[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const url = (locale: Locale, path: string) => {
    const localized = localePath(locale, path);
    return localized === "/" ? base : `${base}${localized}`;
  };
  return PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: url(locale, page.path),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages: { en: url("en", page.path), ko: url("ko", page.path), "x-default": url("en", page.path) } },
    })),
  );
}
