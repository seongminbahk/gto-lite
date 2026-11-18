import Link from "next/link";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/paths";
import { siteCopy } from "@/lib/seo/siteCopy";

/**
 * What the site is, in words the server renders: below the solver, so the
 * first screen stays the tool, and in the HTML, so search engines read it.
 */
export function HomeIntro({ locale }: { locale: Locale }) {
  const copy = siteCopy(locale);
  return (
    <section aria-labelledby="home-intro" className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-line px-4 py-6 lg:px-6">
      <h1 id="home-intro" className="text-base font-semibold text-ink">
        {copy.heading}
      </h1>
      {copy.intro.map((paragraph) => (
        <p key={paragraph} className="max-w-3xl text-sm text-ink-muted">
          {paragraph}
        </p>
      ))}
      <p className="text-sm">
        <Link href={localePath(locale, "/about")} className="text-accent underline-offset-2 hover:underline">
          {copy.aboutLink}
        </Link>
      </p>
    </section>
  );
}
