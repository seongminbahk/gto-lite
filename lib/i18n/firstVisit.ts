import type { Locale } from "./messages";
import { localePath } from "./paths";

// Pure helpers for the proxy that sends a Korean browser's first visit to the
// Korean address, so the pages it shares and the pages search engines see
// are the /ko ones.

/** Remembers the visitor's language choice where the server can read it. */
export const LOCALE_COOKIE = "gtoLite.locale";

/** Crawlers and link-preview fetchers keep the address they asked for. */
const BOT_PATTERN = /bot|crawl|spider|slurp|yeti|daum|kakaotalk-scrap|facebookexternalhit|preview|lighthouse/i;

/** The language the browser ranks highest, by q-value; null without a header. */
export function preferredLanguage(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) return null;
  let best: { tag: string; q: number } | null = null;
  for (const part of acceptLanguage.split(",")) {
    const [rawTag, ...params] = part.trim().split(";");
    const tag = rawTag.trim().toLowerCase();
    if (!tag || tag === "*") continue;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) continue;
    if (!best || q > best.q) best = { tag, q };
  }
  return best?.tag ?? null;
}

export interface FirstVisitRequest {
  pathname: string;
  search: string;
  acceptLanguage: string | null;
  userAgent: string | null;
  /** The remembered choice from the cookie, if any. */
  storedLocale: string | null;
}

/**
 * Where to send an English address on a first visit: its /ko address when the
 * browser prefers Korean and no choice is remembered; otherwise null (stay).
 */
export function firstVisitRedirect(request: FirstVisitRequest): string | null {
  if (request.storedLocale === "en" || request.storedLocale === "ko") return null;
  if (request.userAgent && BOT_PATTERN.test(request.userAgent)) return null;
  if (!preferredLanguage(request.acceptLanguage)?.startsWith("ko")) return null;
  const target = localePath("ko" satisfies Locale, request.pathname);
  if (target === request.pathname) return null;
  return `${target}${request.search}`;
}
