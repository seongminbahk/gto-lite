import { describe, expect, it } from "vitest";
import { allSpotPages } from "@/lib/seo/spotPages";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists every page in both languages, each naming its twin", () => {
    const entries = sitemap();
    const urls = entries.map((e) => new URL(e.url).pathname);
    expect(urls.slice(0, 6)).toEqual(["/", "/ko", "/about", "/ko/about", "/ranges", "/ko/ranges"]);
    expect(entries).toHaveLength(2 * (3 + allSpotPages().length));
    expect(urls).toContain("/ranges/mtt/20bb/btn-open");
    expect(urls).toContain("/ko/ranges/cash-6max/100bb/co-open");
    const koAbout = entries.find((e) => e.url.endsWith("/ko/about"))!;
    expect(koAbout.alternates?.languages).toMatchObject({
      en: expect.stringMatching(/\/about$/),
      ko: expect.stringMatching(/\/ko\/about$/),
      "x-default": expect.stringMatching(/\/about$/),
    });
  });
});
