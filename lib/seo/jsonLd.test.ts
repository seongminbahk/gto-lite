import { describe, expect, it } from "vitest";
import { serializeJsonLd, softwareApplicationJsonLd } from "./jsonLd";

describe("softwareApplicationJsonLd", () => {
  it("serializes to valid JSON describing a free web app in two languages", () => {
    const parsed = JSON.parse(serializeJsonLd(softwareApplicationJsonLd()));
    expect(parsed).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "gtoLite",
      applicationCategory: "GameApplication",
      operatingSystem: "Web browser",
      inLanguage: ["en", "ko"],
      offers: { "@type": "Offer", price: "0" },
    });
    expect(parsed.url).toMatch(/^https?:\/\//);
  });

  it("escapes < so a string can't close the script tag", () => {
    const out = serializeJsonLd({ note: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).note).toBe("</script><script>alert(1)</script>");
  });
});
