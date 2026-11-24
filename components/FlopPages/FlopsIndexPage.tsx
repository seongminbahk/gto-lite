import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { flopCopy } from "@/lib/seo/flopCopy";
import { FLOP_BOARDS, FLOP_SPOTS, flopPath, type FlopPagesData } from "@/lib/seo/flopPages";
import { PageChrome } from "@/components/RangePages/PageChrome";

/** Every flop page, by pot. */
export function FlopsIndexPage({ locale, data }: { locale: Locale; data: FlopPagesData }) {
  const copy = flopCopy(locale);
  return (
    <PageChrome>
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{copy.index.heading}</h1>
        {copy.index.intro.map((line) => (
          <p key={line} className="text-base text-ink-muted">
            {line}
          </p>
        ))}
      </div>
      {FLOP_SPOTS.map((spot) => {
        const boards = FLOP_BOARDS.filter((b) => data.spots[spot.slug]?.[b.slug]);
        if (boards.length === 0) return null;
        return (
          <section key={spot.slug} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">{copy.potName({ spot, board: boards[0] })}</h2>
            <ul className="flex flex-wrap gap-2">
              {boards.map((board) => (
                <li key={board.slug}>
                  <Link
                    href={localePath(locale, flopPath({ spot, board }))}
                    className="rounded border border-line-strong px-2 py-1 font-mono text-sm text-ink-muted hover:bg-raised hover:text-ink"
                  >
                    {board.cards.join("")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-sm text-ink-muted">{copy.method}</p>
    </PageChrome>
  );
}
