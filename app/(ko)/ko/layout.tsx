import type { Metadata, Viewport } from "next";
import { RootShell } from "@/components/RootShell";
import { LocaleProvider } from "@/lib/i18n/locale";
import { rootMetadata } from "@/lib/seo/metadata";
import { VIEWPORT } from "@/lib/seo/viewport";

export const metadata: Metadata = rootMetadata("ko");
export const viewport: Viewport = VIEWPORT;

/** Pages under /ko: always Korean, rendered in Korean on the server too. */
export default function KoreanLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell lang="ko">
      <LocaleProvider locale="ko">{children}</LocaleProvider>
    </RootShell>
  );
}
