import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { STRENGTH_BUCKETS } from "@/lib/explain/handStrength";
import { formatPercent } from "@/lib/format";
import { gameFormatById } from "@/lib/solveEngine/gameFormat";
import { DEFAULT_RAKE_SETTINGS } from "@/lib/solveEngine/rake";
import { CHIP_EV } from "@/lib/solveEngine/icm";
import { encodeSpot } from "@/lib/share/spotLink";
import { breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { flopCopy } from "@/lib/seo/flopCopy";
import { FLOP_BOARDS, FLOP_SPOTS, FLOPS_INDEX_PATH, flopPath, type FlopBoardData, type FlopNodeSummary, type FlopPage, type FlopPagesData } from "@/lib/seo/flopPages";
import { PageChrome } from "@/components/RangePages/PageChrome";

const CHIP = "rounded border border-line-strong px-2 py-1 font-mono text-sm text-ink-muted hover:bg-raised hover:text-ink";
const CELL = "px-2 py-1 text-right font-mono tabular-nums";

/** One flop in one pot: the solver's strategy at the first three decisions, by hand strength. */
export function FlopSpotPage({ locale, page, data, all }: { locale: Locale; page: FlopPage; data: FlopBoardData; all: FlopPagesData }) {
  const copy = flopCopy(locale);
  const href = (p: string) => localePath(locale, p);
  const solverQuery = encodeSpot({
    settings: { stackBb: 100, format: gameFormatById("cash-6")!, rake: DEFAULT_RAKE_SETTINGS, icm: CHIP_EV },
    path: page.spot.preflop,
    postflop: { board: page.board.cards, streets: [] },
  });
  const faq = copy.faq(page, data);
  const crumbs = breadcrumbJsonLd([
    { name: copy.allFlops, path: href(FLOPS_INDEX_PATH) },
    { name: copy.heading(page), path: href(flopPath(page)) },
  ]);
  const otherBoards = FLOP_BOARDS.filter((b) => b.slug !== page.board.slug && all.spots[page.spot.slug]?.[b.slug]);
  const otherSpots = FLOP_SPOTS.filter((s) => s.slug !== page.spot.slug && all.spots[s.slug]?.[page.board.slug]);

  return (
    <PageChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd(faq)) }} />
      <nav className="text-sm text-ink-muted">
        <Link href={href(FLOPS_INDEX_PATH)} className="hover:text-ink hover:underline">
          {copy.allFlops}
        </Link>
        {" / "}
        {copy.potName(page)}
      </nav>
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{copy.heading(page)}</h1>
        {copy.summary(page, data).map((line) => (
          <p key={line} className="text-base text-ink-muted">
            {line}
          </p>
        ))}
        <a href={`${href("/")}?${solverQuery}`} className="self-start rounded bg-accent px-3 py-1.5 text-sm font-medium text-canvas pointer-coarse:min-h-11">
          {copy.openInSolver}
        </a>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">{copy.rangesHeading}</h2>
        <p className="text-sm text-ink-muted">{copy.bucketHint}</p>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="px-2 py-1 text-left font-medium">
                  {copy.handGroup}
                </th>
                <th scope="col" className={CELL}>
                  {data.root.seat}
                </th>
                <th scope="col" className={CELL}>
                  {data.afterCheck.seat}
                </th>
              </tr>
            </thead>
            <tbody>
              {STRENGTH_BUCKETS.map((b) => (
                <tr key={b} className="border-t border-line">
                  <th scope="row" className="px-2 py-1 text-left font-medium text-ink">
                    {copy.bucketName[b]}
                  </th>
                  <td className={CELL}>{formatPercent(data.root.buckets[b].share)}</td>
                  <td className={CELL}>{formatPercent(data.afterCheck.buckets[b].share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <NodeTable locale={locale} heading={copy.nodeHeading.root(page)} node={data.root} />
      <NodeTable locale={locale} heading={copy.nodeHeading.afterCheck(page)} node={data.afterCheck} />
      {data.facingBet && <NodeTable locale={locale} heading={copy.nodeHeading.facingBet(page, data)} node={data.facingBet} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">{copy.faqHeading}</h2>
        {faq.map((item) => (
          <div key={item.question} className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-ink">{item.question}</h3>
            <p className="text-sm text-ink-muted">{item.answer}</p>
          </div>
        ))}
      </section>

      {otherSpots.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{copy.otherPot}</h2>
          <ul className="flex flex-wrap gap-2">
            {otherSpots.map((spot) => (
              <li key={spot.slug}>
                <Link href={href(flopPath({ spot, board: page.board }))} className={CHIP}>
                  {copy.potName({ spot, board: page.board })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">{copy.otherBoards(page)}</h2>
        <ul className="flex flex-wrap gap-2">
          {otherBoards.map((board) => (
            <li key={board.slug}>
              <Link href={href(flopPath({ spot: page.spot, board }))} className={CHIP}>
                {board.cards.join("")}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-ink-muted">{copy.method}</p>
    </PageChrome>
  );
}

function NodeTable({ locale, heading, node }: { locale: Locale; heading: string; node: FlopNodeSummary }) {
  const copy = flopCopy(locale);
  const shown = node.actions.map((a, k) => ({ a, k })).filter(({ a }) => a.share >= 0.001 || node.actions.length <= 3);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-ink">{heading}</h2>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="px-2 py-1 text-left font-medium">
                {copy.handGroup}
              </th>
              {shown.map(({ a, k }) => (
                <th key={k} scope="col" className={CELL}>
                  {copy.actionName(a)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line font-medium text-ink">
              <th scope="row" className="px-2 py-1 text-left">
                {copy.overall}
              </th>
              {shown.map(({ a, k }) => (
                <td key={k} className={CELL}>
                  {formatPercent(a.share)}
                </td>
              ))}
            </tr>
            {STRENGTH_BUCKETS.filter((b) => node.buckets[b].share > 0).map((b) => (
              <tr key={b} className="border-t border-line text-ink-muted">
                <th scope="row" className="px-2 py-1 text-left font-medium text-ink">
                  {copy.bucketName[b]}
                </th>
                {shown.map(({ k }) => (
                  <td key={k} className={CELL}>
                    {formatPercent(node.buckets[b].actions[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
