import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { rangeCopy } from "@/lib/seo/rangeCopy";
import { openersBefore, RANGE_FORMATS, spotPath, type RangeFormatDef } from "@/lib/seo/spotPages";

import { LEARN_COPY, LEARN_PATH } from "@/lib/seo/learnContent";
import { flopCopy } from "@/lib/seo/flopCopy";
import { FLOPS_INDEX_PATH } from "@/lib/seo/flopPages";
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
        <Link href={localePath(locale, LEARN_PATH)} className="text-sm text-accent underline-offset-2 hover:underline">
          {LEARN_COPY[locale].heading} →
        </Link>
        <Link href={localePath(locale, FLOPS_INDEX_PATH)} className="text-sm text-accent underline-offset-2 hover:underline">
          {flopCopy(locale).index.heading} →
        </Link>
      </div>
      {RANGE_FORMATS.map((format) => (
        <section key={format.slug} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{copy.formatShort[format.slug]}</h2>
          <h3 className="text-sm font-medium text-ink-muted">{copy.index.openHeading}</h3>
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
          {format.vsOpen.stacks.map((stackBb) => (
            <VsOpenTable key={stackBb} locale={locale} format={format} stackBb={stackBb} />
          ))}
        </section>
      ))}
    </PageChrome>
  );
}

/** One stack's defending pages: a defending seat per row, an opener per column. */
function VsOpenTable({ locale, format, stackBb }: { locale: Locale; format: RangeFormatDef; stackBb: number }) {
  const copy = rangeCopy(locale);
  const openers = format.seats.filter((o) => format.vsOpen.defenders.some((d) => openersBefore(format, d).includes(o)));
  return (
    <>
      <h3 className="text-sm font-medium text-ink-muted">{copy.index.vsOpenHeading(stackBb)}</h3>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-1 text-left font-medium text-ink-muted">
                {copy.index.defender} \ {copy.index.opener}
              </th>
              {openers.map((opener) => (
                <th key={opener} scope="col" className="px-1 text-center font-medium text-ink-muted">
                  {opener}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {format.vsOpen.defenders.map((seat) => (
              <tr key={seat}>
                <th scope="row" className="px-1 text-left font-medium text-ink">
                  {seat}
                </th>
                {openers.map((opener) => (
                  <td key={opener}>
                    {openersBefore(format, seat).includes(opener) ? (
                      <Link
                        href={localePath(locale, spotPath({ format: format.slug, stackBb, seat, kind: "vs-open", opener }))}
                        aria-label={`${seat} vs ${opener} ${stackBb}bb`}
                        className="block rounded border border-line-strong px-2 py-1 text-center font-mono text-ink-muted hover:bg-raised hover:text-ink"
                      >
                        vs
                      </Link>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
