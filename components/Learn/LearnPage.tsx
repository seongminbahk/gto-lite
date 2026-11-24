import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { definedTermSetJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { conceptGroups, LEARN_COPY, LEARN_PATH } from "@/lib/seo/learnContent";
import { PageChrome } from "@/components/RangePages/PageChrome";

/** The concept notes as one glossary page, grouped by topic, each concept anchored by its id. */
export function LearnPage({ locale }: { locale: Locale }) {
  const copy = LEARN_COPY[locale];
  const groups = conceptGroups();
  const terms = groups.flatMap((g) => g.concepts).map((c) => ({ id: c.id, name: c.title[locale], description: c.note[locale] }));
  return (
    <PageChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(definedTermSetJsonLd(copy.heading, localePath(locale, LEARN_PATH), terms)) }}
      />
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{copy.heading}</h1>
        <p className="text-base text-ink-muted">{copy.intro}</p>
      </div>
      <nav aria-label={copy.contents} className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">{copy.contents}</h2>
        <ul className="flex flex-wrap gap-2">
          {groups.flatMap((g) => g.concepts).map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} className="rounded border border-line-strong px-2 py-1 text-sm text-ink-muted hover:bg-raised hover:text-ink">
                {c.title[locale]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {groups.map((g) => (
        <section key={g.id} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">{g.title[locale]}</h2>
          {g.concepts.map((c) => (
            <article key={c.id} id={c.id} className="flex scroll-mt-4 flex-col gap-1">
              <h3 className="text-base font-medium text-ink">{c.title[locale]}</h3>
              <p className="text-base text-ink-muted">{c.note[locale]}</p>
              {c.links.length > 0 && (
                <p className="text-sm text-ink-muted">
                  {copy.tryIt}{" "}
                  {c.links.map((l, i) => (
                    <span key={l.path}>
                      {i > 0 && ", "}
                      <Link href={localePath(locale, l.path)} className="text-accent underline-offset-2 hover:underline">
                        {l.label[locale]}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </section>
      ))}
    </PageChrome>
  );
}
