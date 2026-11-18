import type { Metadata } from "next";
import { AboutPage } from "@/components/About/AboutPage";
import { aboutMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = aboutMetadata("ko");

export default function KoreanAbout() {
  return <AboutPage />;
}
