import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { rangeCopy } from "@/lib/seo/rangeCopy";
import { RANGE_FORMATS, spotPath } from "@/lib/seo/spotPages";
import { PageChrome } from "./PageChrome";

/** Every range page, by format: a seat per row, a stack per column. */
export function RangesIndexPage({ locale }: { locale: Locale }) {
  const copy = rangeCopy(locale);
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
      {RANGE_FORMATS.map((format) => (
        <section key={format.slug} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{copy.formatShort[format.slug]}</h2>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="px-1 text-left font-medium text-ink-muted">
                    {copy.index.seat}
                  </th>
                  {format.stacks.map((stack) => (
                    <th key={stack} scope="col" className="px-1 text-center font-mono font-medium tabular-nums text-ink-muted">
                      {stack}bb
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {format.seats.map((seat) => (
                  <tr key={seat}>
                    <th scope="row" className="px-1 text-left font-medium text-ink">
                      {seat}
                    </th>
                    {format.stacks.map((stackBb) => (
                      <td key={stackBb}>
                        <Link
                          href={localePath(locale, spotPath({ format: format.slug, stackBb, seat, kind: "open" }))}
                          aria-label={`${seat} ${stackBb}bb`}
                          className="block rounded border border-line-strong px-2 py-1 text-center font-mono tabular-nums text-ink-muted hover:bg-raised hover:text-ink"
                        >
                          {stackBb}
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </PageChrome>
  );
}
