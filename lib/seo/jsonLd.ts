import { REPO_URL, SITE_NAME, siteUrl } from "@/lib/siteUrl";
import { siteCopy } from "./siteCopy";

/** schema.org description of the site as a free web app, for search engines. */
export function softwareApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: siteUrl(),
    description: siteCopy("en").description,
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    inLanguage: ["en", "ko"],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    sameAs: [REPO_URL],
  };
}

/** JSON for a <script type="application/ld+json">, with `<` escaped so no string in it can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
