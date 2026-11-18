import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { formatRangeText, weightsOfHands } from "@/lib/handRange/rangeText";
import { rangeCopy } from "@/lib/seo/rangeCopy";
import { otherSeats, otherStacks, RANGES_INDEX_PATH, spotPath, type SpotPage } from "@/lib/seo/spotPages";
import type { SolvedSpot } from "@/lib/seo/spotSolve";
import { rangeStats } from "@/lib/seo/spotSummary";
import { PageChrome } from "./PageChrome";
import { StaticRangeChart } from "./StaticRangeChart";

const ACTIONS = ["raise", "call", "allin"] as const;
const CHIP = "rounded border border-line-strong px-2 py-1 font-mono text-sm tabular-nums text-ink-muted hover:bg-raised hover:text-ink";

/** One preflop spot as a page of its own: the chart, the range as text, and a way into the solver at that spot. */
export function RangeSpotPage({ locale, page, solved }: { locale: Locale; page: SpotPage; solved: SolvedSpot }) {
  const copy = rangeCopy(locale);
  const stats = rangeStats(solved.hands);
  const href = (p: string) => localePath(locale, p);
  const solverHref = `${href("/")}${solved.solverQuery ? `?${solved.solverQuery}` : ""}`;
  const texts = ACTIONS.map((action) => ({ action, text: formatRangeText(weightsOfHands(solved.hands, action)) })).filter((t) => t.text);

  return (
    <PageChrome>
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

      <SpotLinks heading={copy.otherStacks(page.seat)} pages={otherStacks(page)} label={(p) => `${p.stackBb}bb`} href={href} />
      <SpotLinks heading={copy.otherSeats(page.stackBb)} pages={otherSeats(page)} label={(p) => p.seat} href={href} />
    </PageChrome>
  );
}

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
