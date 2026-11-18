import { describe, expect, it } from "vitest";
import { aboutMetadata, pageAlternates } from "./metadata";

describe("page metadata", () => {
  it("each page's canonical is its own language's address, with both twins named", () => {
    expect(pageAlternates("ko", "/about")).toEqual({
      canonical: "/ko/about",
      languages: { en: "/about", ko: "/ko/about", "x-default": "/about" },
    });
  });

  it("the Korean About page uses the Korean text", () => {
    const ko = aboutMetadata("ko");
    expect(ko.title).toBe("소개");
    expect(String(ko.description)).toMatch(/무료/);
    expect(aboutMetadata("en").title).toBe("About");
  });
});
