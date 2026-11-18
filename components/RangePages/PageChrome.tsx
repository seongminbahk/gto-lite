"use client";

import type { ReactNode } from "react";
import { AboutLink, AppHeader } from "@/components/AppHeader";
import { LanguageToggle } from "@/components/Settings/LanguageToggle";

/** The header over the /ranges pages, with the column they share. */
export function PageChrome({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-3 pb-16">
      <AppHeader homeLink>
        <AboutLink />
        <LanguageToggle />
      </AppHeader>
      {children}
    </div>
  );
}
