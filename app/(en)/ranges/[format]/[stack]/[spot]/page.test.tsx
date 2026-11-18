import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n/locale";
import RangeSpot, { generateMetadata, generateStaticParams } from "./page";
import KoreanRangeSpot, { generateMetadata as koreanMetadata } from "@/app/(ko)/ko/ranges/[format]/[stack]/[spot]/page";

const params = { format: "mtt", stack: "20bb", spot: "btn-open" };
const props = { params: Promise.resolve(params), searchParams: Promise.resolve({}) } as never;

describe("range spot page", () => {
  it("builds a page for every spot", () => {
    expect(generateStaticParams()).toContainEqual(params);
  });

  it("renders the chart's 169 cells, the summary, the range text and the solver link on the server", async () => {
    const html = renderToString(await RangeSpot(props));
    expect(html).toMatch(/<h1[^>]*>BTN open range at 20bb — MTT<\/h1>/);
    expect(html.match(/data-testid="hand-cell"/g)).toHaveLength(169);
    expect(html).toContain("when everyone folds to the BTN");
    expect(html).toMatch(/href="\/\?[^"]*s=20[^"]*p=fffff/);
    expect(html).toContain('href="/ranges/mtt/40bb/btn-open"');
    expect(html).toContain('href="/ranges/mtt/20bb/co-open"');
  });

  it("names its canonical address and its Korean twin", async () => {
    const metadata = await generateMetadata(props);
    expect(metadata.alternates).toEqual({
      canonical: "/ranges/mtt/20bb/btn-open",
      languages: { en: "/ranges/mtt/20bb/btn-open", ko: "/ko/ranges/mtt/20bb/btn-open", "x-default": "/ranges/mtt/20bb/btn-open" },
    });
    expect(metadata.title).toBe("BTN Open Range at 20bb — MTT Preflop Chart");
  });

  it("the Korean page is Korean and links within /ko", async () => {
    const html = renderToString(<LocaleProvider locale="ko">{await KoreanRangeSpot(props)}</LocaleProvider>);
    expect(html).toContain("오픈 레인지");
    expect(html).toContain('href="/ko/ranges/mtt/40bb/btn-open"');
    expect(html).toMatch(/href="\/ko\?[^"]*s=20/);
    expect((await koreanMetadata(props)).alternates).toMatchObject({ canonical: "/ko/ranges/mtt/20bb/btn-open" });
  });
});
