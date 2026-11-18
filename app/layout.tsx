import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_NAME, siteUrl } from "@/lib/siteUrl";
import { serializeJsonLd, softwareApplicationJsonLd } from "@/lib/seo/jsonLd";
import { siteCopy } from "@/lib/seo/siteCopy";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const { title, description } = siteCopy("en");
/** Search Console's HTML-tag check, only when the site is verified that way rather than by DNS. */
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

// The preview image and icons come from the files beside this one (opengraph-image, twitter-image, icon, apple-icon).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: title, template: `%s · ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareApplicationJsonLd()) }} />
        {children}
        {/* Cookieless page counts, loaded from this origin so the COEP header in next.config.ts lets it through. */}
        <Analytics />
      </body>
    </html>
  );
}
