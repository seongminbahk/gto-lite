import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { LocaleProvider, languageSwitchHref, localePath, pickLocale, resolveLocale, stripLocale, useLocale, useLocalePath } from "./locale";

describe("pickLocale", () => {
  it("keeps a remembered choice whatever the browser's language", () => {
    expect(pickLocale("en", "ko-KR")).toBe("en");
    expect(pickLocale("ko", "en-US")).toBe("ko");
  });

  it("starts a first visit in Korean for a Korean browser, and in English for any other", () => {
    expect(pickLocale(null, "ko-KR")).toBe("ko");
    expect(pickLocale(null, "ko")).toBe("ko");
    expect(pickLocale(null, "en-US")).toBe("en");
    expect(pickLocale(null, "ja-JP")).toBe("en");
    expect(pickLocale(null, undefined)).toBe("en");
  });

  it("ignores a stored value it doesn't know", () => {
    expect(pickLocale("fr", "ko-KR")).toBe("ko");
  });
});

describe("forced locale", () => {
  it("an address's language beats the remembered choice", () => {
    expect(resolveLocale("ko", "en")).toBe("ko");
    expect(resolveLocale("en", "ko")).toBe("en");
    expect(resolveLocale(null, "ko")).toBe("ko");
  });

  it("LocaleProvider pins its subtree to Korean, on the server too, whatever this browser chose", () => {
    function Probe() {
      return <span>{useLocale()}</span>;
    }
    expect(renderToString(<Probe />)).toContain("en");
    expect(renderToString(<LocaleProvider locale="ko"><Probe /></LocaleProvider>)).toContain("ko");
    render(<LocaleProvider locale="ko"><Probe /></LocaleProvider>);
    expect(screen.getByText("ko")).toBeInTheDocument();
  });

  it("links stay in the address's language", () => {
    function Probe() {
      return <span>{useLocalePath("/about#preflop")}</span>;
    }
    expect(renderToString(<Probe />)).toContain("/about#preflop");
    expect(renderToString(<LocaleProvider locale="ko"><Probe /></LocaleProvider>)).toContain("/ko/about#preflop");
  });
});

describe("addresses", () => {
  it("puts Korean pages under /ko and takes them back out", () => {
    expect(localePath("ko", "/")).toBe("/ko");
    expect(localePath("ko", "/about")).toBe("/ko/about");
    expect(localePath("ko", "/ko/about")).toBe("/ko/about");
    expect(localePath("en", "/ko")).toBe("/");
    expect(localePath("en", "/ko/about")).toBe("/about");
    expect(localePath("en", "/about")).toBe("/about");
    expect(stripLocale("/korea")).toBe("/korea");
  });

  it("the toggle goes to the twin page with the spot's query and anchor kept", () => {
    expect(languageSwitchHref("/", "?s=40&f=cash-6", "", "ko")).toBe("/ko?s=40&f=cash-6");
    expect(languageSwitchHref("/ko", "?s=40", "", "en")).toBe("/?s=40");
    expect(languageSwitchHref("/ko/about", "", "#preflop", "en")).toBe("/about#preflop");
    expect(languageSwitchHref("/about", "", "", "ko")).toBe("/ko/about");
  });

  it("stays put when the page is already in that language", () => {
    expect(languageSwitchHref("/", "?s=40", "", "en")).toBeNull();
    expect(languageSwitchHref("/ko/about", "", "", "ko")).toBeNull();
  });
});

describe("remembered choice cookie", () => {
  it("setLocale writes the cookie the proxy reads", async () => {
    const { setLocale } = await import("./locale");
    const { LOCALE_COOKIE } = await import("./firstVisit");
    setLocale("en");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
    setLocale("ko");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=ko`);
    setLocale("en");
  });
});
