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

/** schema.org breadcrumbs: each item a name and an absolute or site-relative address. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: new URL(item.path, siteUrl()).toString() })),
  };
}

/** schema.org questions and answers, the same ones the page shows. */
export function faqJsonLd(faq: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
  };
}

/** schema.org glossary: the page's terms, each anchored on the page by its id. */
export function definedTermSetJsonLd(name: string, path: string, terms: { id: string; name: string; description: string }[]): Record<string, unknown> {
  const url = new URL(path, siteUrl()).toString();
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name,
    url,
    hasDefinedTerm: terms.map((t) => ({ "@type": "DefinedTerm", name: t.name, description: t.description, url: `${url}#${t.id}` })),
  };
}
