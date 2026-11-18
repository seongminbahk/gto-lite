import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider, setLocale } from "@/lib/i18n/locale";
import { loadPage } from "@/lib/i18n/loadPage";
import { LanguageToggle } from "./LanguageToggle";

vi.mock("@/lib/i18n/loadPage", () => ({ loadPage: vi.fn() }));

// Node's own localStorage shadows jsdom's and is unusable without a file, so each test gets a plain one.
let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) },
  });
});

afterEach(() => {
  act(() => setLocale("en"));
  window.history.replaceState(null, "", "/");
  vi.mocked(loadPage).mockClear();
});

describe("LanguageToggle", () => {
  it("starts in English", () => {
    render(<LanguageToggle />);
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "한" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to Korean, remembers it, and sets the page language", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button", { name: "한" }));
    expect(screen.getByRole("button", { name: "한" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "언어" })).toBeInTheDocument();
    expect(stored.get("gtoLite.locale")).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("moves to the Korean address, keeping the spot in the query", () => {
    window.history.replaceState(null, "", "/?s=40&f=cash-6");
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button", { name: "한" }));
    expect(loadPage).toHaveBeenCalledWith("/ko?s=40&f=cash-6");
  });

  it("under /ko shows Korean and goes back to the English address", () => {
    window.history.replaceState(null, "", "/ko/about#preflop");
    render(
      <LocaleProvider locale="ko">
        <LanguageToggle />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "한" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(stored.get("gtoLite.locale")).toBe("en");
    expect(loadPage).toHaveBeenCalledWith("/about#preflop");
  });

  it("stays on the page when it is already that language's address", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(loadPage).not.toHaveBeenCalled();
  });
});
