import type { Metadata, Viewport } from "next";
import { RootShell } from "@/components/RootShell";
import { rootMetadata } from "@/lib/seo/metadata";
import { VIEWPORT } from "@/lib/seo/viewport";

export const metadata: Metadata = rootMetadata("en");
export const viewport: Viewport = VIEWPORT;

/** English pages, and the home page, where a remembered or browser language may still switch the text. */
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>;
}
