import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n/locale";
import Home, { metadata } from "./page";
import KoreanHome, { metadata as koMetadata } from "../(ko)/ko/page";

describe("home page on the server", () => {
  it("puts the heading and the introduction in the HTML, below the solver's outline", () => {
    const html = renderToString(<Home />);
    expect(html).toMatch(/<h1[^>]*>Free GTO poker solver: preflop ranges, ICM and postflop<\/h1>/);
    expect(html).toContain("push/fold Nash ranges");
    expect(html).toContain('href="/about"');
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<h1"));
  });

  it("renders /ko in Korean on the server, linking within /ko", () => {
    const html = renderToString(
      <LocaleProvider locale="ko">
        <KoreanHome />
      </LocaleProvider>,
    );
    expect(html).toMatch(/<h1[^>]*>무료 GTO 포커 솔버/);
    expect(html).toContain('href="/ko/about"');
  });

  it("names its twin in the other language", () => {
    expect(metadata.alternates).toEqual({ canonical: "/", languages: { en: "/", ko: "/ko", "x-default": "/" } });
    expect(koMetadata.alternates).toEqual({ canonical: "/ko", languages: { en: "/", ko: "/ko", "x-default": "/" } });
    expect(String(koMetadata.description)).toContain("무료 GTO 포커 솔버");
  });
});
