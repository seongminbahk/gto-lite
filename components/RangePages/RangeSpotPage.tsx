import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { formatRangeText, weightsOfHands } from "@/lib/handRange/rangeText";
import { formatPercent } from "@/lib/format";
import { breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { rangeCopy, type SpotComparison } from "@/lib/seo/rangeCopy";
import { edgeQuestions, mixedHandShares, rangeDiff } from "@/lib/seo/spotInsights";
import { otherSeats, otherStacks, RANGES_INDEX_PATH, spotPath, type SpotPage } from "@/lib/seo/spotPages";
import type { NeighborSpot, SolvedSpot } from "@/lib/seo/spotSolve";
import { rangeStats } from "@/lib/seo/spotSummary";
import { PageChrome } from "./PageChrome";
import { StaticRangeChart } from "./StaticRangeChart";

const ACTIONS = ["raise", "call", "allin"] as const;
const CHIP = "rounded border border-line-strong px-2 py-1 font-mono text-sm tabular-nums text-ink-muted hover:bg-raised hover:text-ink";

/** One preflop spot as a page of its own: the chart, the range as text, and a way into the solver at that spot. */
export function RangeSpotPage({
  locale,
  page,
  solved,
  neighbors,
}: {
  locale: Locale;
  page: SpotPage;
  solved: SolvedSpot;
  neighbors: { seat: NeighborSpot | null; stack: NeighborSpot | null };
}) {
  const copy = rangeCopy(locale);
  const stats = rangeStats(solved.hands);
  const compare = (n: NeighborSpot | null): SpotComparison | null => (n ? { other: n.page, diff: rangeDiff(solved.hands, n.hands) } : null);
  const comparisons = [compare(neighbors.seat), compare(neighbors.stack)].filter((c): c is SpotComparison => c !== null);
  const stackComparison = compare(neighbors.stack);
  const mixed = mixedHandShares(solved.hands);
  const faq = copy.faq(page, stats, edgeQuestions(solved.hands), stackComparison);
  const crumbs = breadcrumbJsonLd([
    { name: copy.allCharts, path: href0(locale, RANGES_INDEX_PATH) },
    { name: copy.heading(page, stats), path: href0(locale, spotPath(page)) },
  ]);
  const href = (p: string) => localePath(locale, p);
  const solverHref = `${href("/")}${solved.solverQuery ? `?${solved.solverQuery}` : ""}`;
  const texts = ACTIONS.map((action) => ({ action, text: formatRangeText(weightsOfHands(solved.hands, action)) })).filter((t) => t.text);

  return (
    <PageChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd(faq)) }} />
      <nav className="text-sm text-ink-muted">
        <Link href={href(RANGES_INDEX_PATH)} className="hover:text-ink hover:underline">
          {copy.allCharts}
        </Link>
        {" / "}
        {copy.formatShort[page.format]}
      </nav>

      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{copy.heading(page, stats)}</h1>
        {copy.summary(page, stats, solved.source).map((line) => (
          <p key={line} className="text-base text-ink-muted">
            {line}
          </p>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={solverHref} className="inline-block rounded bg-accent px-3 py-1.5 text-sm font-medium text-canvas pointer-coarse:min-h-11">
            {copy.openInSolver}
          </a>
          <Link href={href("/about#preflop")} className="text-sm text-accent underline-offset-2 hover:underline">
            {copy.howMade}
          </Link>
        </div>
      </div>

      <StaticRangeChart hands={solved.hands} />

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">{copy.rangeText}</h2>
        <p className="text-sm text-ink-muted">{copy.rangeTextHint}</p>
        {texts.map(({ action, text }) => (
          <div key={action} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">{copy.actionName[action]}</span>
            <pre className="select-all whitespace-pre-wrap break-words rounded border border-line bg-surface p-2 font-mono text-sm text-ink">{text}</pre>
          </div>
        ))}
      </section>

      {comparisons.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{copy.compareHeading}</h2>
          {comparisons.map((c) => (
            <p key={spotPath(c.other)} className="text-sm text-ink-muted">
              {copy.compareLine(page, c)}{" "}
              <Link href={href(spotPath(c.other))} className="text-accent underline-offset-2 hover:underline">
                {c.other.seat !== page.seat ? c.other.seat : `${c.other.stackBb}bb`}
              </Link>
            </p>
          ))}
        </section>
      )}

      {mixed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{copy.mixedHeading}</h2>
          <p className="text-sm text-ink-muted">{copy.mixedHint}</p>
          <ul className="flex flex-wrap gap-2">
            {mixed.map((m) => (
              <li key={m.hand} className="rounded border border-line px-2 py-1 font-mono text-sm tabular-nums text-ink">
                {m.hand} {formatPercent(m.played)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">{copy.faqHeading}</h2>
        {faq.map((item) => (
          <div key={item.question} className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-ink">{item.question}</h3>
            <p className="text-sm text-ink-muted">{item.answer}</p>
          </div>
        ))}
      </section>

      <SpotLinks heading={copy.otherStacks(page.seat)} pages={otherStacks(page)} label={(p) => `${p.stackBb}bb`} href={href} />
      <SpotLinks heading={copy.otherSeats(page.stackBb)} pages={otherSeats(page)} label={(p) => p.seat} href={href} />
    </PageChrome>
  );
}

const href0 = (locale: Locale, path: string) => localePath(locale, path);

function SpotLinks({ heading, pages, label, href }: { heading: string; pages: SpotPage[]; label: (p: SpotPage) => string; href: (path: string) => string }) {
  if (pages.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-ink">{heading}</h2>
      <ul className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <li key={spotPath(p)}>
            <Link href={href(spotPath(p))} className={CHIP}>
              {label(p)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
