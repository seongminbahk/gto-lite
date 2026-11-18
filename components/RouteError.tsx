"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { ErrorNotice, PRIMARY_ACTION, SECONDARY_ACTION } from "@/components/ErrorNotice";
import { useLocalePath, useMessages } from "@/lib/i18n/locale";

/** A page that failed, inside its layout: retry, or go back to the solver in the same language. */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useMessages();
  const home = useLocalePath("/");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorNotice title={t.errorPage.title} body={t.errorPage.body}>
      <button type="button" onClick={() => retry()} className={PRIMARY_ACTION}>
        {t.common.retry}
      </button>
      <Link href={home} className={SECONDARY_ACTION}>
        {t.header.home}
      </Link>
    </ErrorNotice>
  );
}
