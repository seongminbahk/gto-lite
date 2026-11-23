import { describe, expect, it } from "vitest";
import { firstVisitRedirect, preferredLanguage } from "./firstVisit";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const visit = (over: Partial<Parameters<typeof firstVisitRedirect>[0]>) =>
  firstVisitRedirect({ pathname: "/", search: "", acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8", userAgent: CHROME, storedLocale: null, ...over });

describe("preferredLanguage", () => {
  it("takes the highest q-value, the first on a tie", () => {
    expect(preferredLanguage("en-US,en;q=0.9,ko;q=0.8")).toBe("en-us");
    expect(preferredLanguage("en;q=0.5,ko-KR;q=0.9")).toBe("ko-kr");
    expect(preferredLanguage("ko,en")).toBe("ko");
    expect(preferredLanguage("*")).toBeNull();
    expect(preferredLanguage(null)).toBeNull();
  });
});

describe("firstVisitRedirect", () => {
  it("sends a Korean browser to the Korean address, keeping the query", () => {
    expect(visit({})).toBe("/ko");
    expect(visit({ pathname: "/about" })).toBe("/ko/about");
    expect(visit({ pathname: "/ranges/mtt/20bb/btn-open", search: "?x=1" })).toBe("/ko/ranges/mtt/20bb/btn-open?x=1");
  });

  it("leaves a remembered choice, other languages and crawlers alone", () => {
    expect(visit({ storedLocale: "en" })).toBeNull();
    expect(visit({ storedLocale: "ko" })).toBeNull();
    expect(visit({ acceptLanguage: "en-US,en;q=0.9,ko;q=0.8" })).toBeNull();
    expect(visit({ acceptLanguage: null })).toBeNull();
    expect(visit({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" })).toBeNull();
    expect(visit({ userAgent: "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)" })).toBeNull();
    expect(visit({ userAgent: "facebookexternalhit/1.1;kakaotalk-scrap/1.0" })).toBeNull();
  });

  it("never redirects a Korean address", () => {
    expect(visit({ pathname: "/ko" })).toBeNull();
    expect(visit({ pathname: "/ko/about" })).toBeNull();
  });
});
