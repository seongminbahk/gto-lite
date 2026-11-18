import type { Metadata, Viewport } from "next";
import { NotFoundNotice } from "@/components/NotFoundNotice";
import { RootShell } from "@/components/RootShell";
import { VIEWPORT } from "@/lib/seo/viewport";

// With a root layout per language there is no single layout for an unmatched address, so this page brings its own document.
export const metadata: Metadata = { title: "Page not found · gtoLite", robots: { index: false } };
export const viewport: Viewport = VIEWPORT;

export default function GlobalNotFound() {
  return (
    <RootShell lang="en">
      <NotFoundNotice />
    </RootShell>
  );
}
