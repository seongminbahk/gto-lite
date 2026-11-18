import type { Metadata } from "next";
import { AboutPage } from "@/components/About/AboutPage";
import { aboutMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = aboutMetadata("en");

export default function About() {
  return <AboutPage />;
}
