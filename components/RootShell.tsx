import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import type { Locale } from "@/lib/i18n/messages";
import { serializeJsonLd, softwareApplicationJsonLd } from "@/lib/seo/jsonLd";
import "@/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The document both root layouts (English at /, Korean at /ko) share; only its language differs. */
export function RootShell({ lang, children }: { lang: Locale; children: ReactNode }) {
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareApplicationJsonLd()) }} />
        {children}
        {/* Cookieless page counts, loaded from this origin so the COEP header in next.config.ts lets it through. */}
        <Analytics />
      </body>
    </html>
  );
}
