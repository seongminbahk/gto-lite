"use client";

import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import { MESSAGES, type Locale, type Messages } from "./messages";
import { localePath } from "./paths";

export { languageSwitchHref, localePath, stripLocale } from "./paths";

const STORAGE_KEY = "gtoLite.locale";
const DEFAULT_LOCALE: Locale = "en";

let current: Locale | null = null;
const listeners = new Set<() => void>();

/** The remembered choice; without one, Korean for a browser set to Korean. */
export function pickLocale(stored: string | null, browserLanguage: string | undefined): Locale {
  if (stored === "ko" || stored === "en") return stored;
  return browserLanguage?.toLowerCase().startsWith("ko") ? "ko" : DEFAULT_LOCALE;
}

function readStored(): Locale {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private modes may refuse storage: go by the browser's language.
  }
  return pickLocale(stored, window.navigator.language);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Locale {
  current ??= readStored();
  return current;
}

/** The server never knows the choice, so it renders English and the client switches after hydration. */
const getServerSnapshot = () => DEFAULT_LOCALE;

/** Remembered in this browser; every component using the hooks below re-renders. */
export function setLocale(locale: Locale) {
  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private modes may refuse storage: the choice then lasts until reload.
  }
  listeners.forEach((listener) => listener());
}

/** The language a page's address fixes (/ko/...), or null where the visitor's choice decides. */
const ForcedLocale = createContext<Locale | null>(null);

/** Pins every component below to one language, on the server too: the pages under /ko. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return createElement(ForcedLocale.Provider, { value: locale }, children);
}

/** An address's language wins over the remembered choice. */
export function resolveLocale(forced: Locale | null, chosen: Locale): Locale {
  return forced ?? chosen;
}

export function useLocale(): Locale {
  const forced = useContext(ForcedLocale);
  const chosen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return resolveLocale(forced, chosen);
}

/** The language the address fixes, if any. */
export function useForcedLocale(): Locale | null {
  return useContext(ForcedLocale);
}

/**
 * The address of `path` ("/", "/about") in the language the current page's
 * address is in, so links under /ko stay under /ko.
 */
export function useLocalePath(path: string): string {
  return localePath(useContext(ForcedLocale) ?? "en", path);
}

export function useMessages(): Messages {
  return MESSAGES[useLocale()];
}
