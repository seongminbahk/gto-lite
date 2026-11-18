import type { Locale } from "./messages";

// Pure address helpers, shared by server metadata and client links.

/** "/about" in Korean is "/ko/about", the home page "/ko". */
export function localePath(locale: Locale, path: string): string {
  const base = stripLocale(path);
  if (locale === "en") return base;
  return base === "/" ? "/ko" : `/ko${base}`;
}

/** The English address of a page: "/ko/about" → "/about", "/ko" → "/". */
export function stripLocale(path: string): string {
  if (path === "/ko") return "/";
  if (path.startsWith("/ko/") || path.startsWith("/ko#") || path.startsWith("/ko?")) {
    const rest = path.slice(3);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return path;
}

/**
 * Where the language toggle goes: the same page in the other language, with
 * the spot in the query kept. Null when the page is already that language's
 * address.
 */
export function languageSwitchHref(pathname: string, search: string, hash: string, locale: Locale): string | null {
  const target = localePath(locale, pathname);
  if (target === pathname) return null;
  return `${target}${search}${hash}`;
}
